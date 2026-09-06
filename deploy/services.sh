#!/usr/bin/env bash
# Services for the cove2e pass, on either backend. Apple Container when the host
# has it (macOS, no Docker needed); otherwise deploy/compose.services.yml through
# docker compose. ONE command either way, because chainstrip's `e2e.servicesUp`
# is one command and it runs on both.
#
#   deploy/services.sh up|down|status
#
# THE BACKEND IS CHOSEN BY WHAT THE HOST HAS, not by a platform name. The first
# version of this script called the Apple Container CLI directly and told a
# Linux reader to run docker compose by hand - fine for a person, useless for
# chainstrip, whose `e2e.servicesUp` has to work wherever the run happens. The
# same defect stopped mattermost's first CI e2e attempt (its services.sh died
# on `container: command not found`, so the suite never ran and covtrim lost
# every function only a browser executes).
#
# WHICH SERVICES: mailhog always. Postgres only where nothing else provides
# one. In CI the baseline job runs postgres as a GitHub Actions service
# container on 5432 and the e2e block's DATABASE_URL points at it, so the
# compose path brings up mailhog alone (postgres sits behind the `db`
# profile; set CALDIY_SERVICES_DB=1 to include it). The Apple Container path
# is for a laptop and brings up both. Postgres data is EPHEMERAL either way:
# e2e wants a clean DB, and Cal binds CALENDSO_ENCRYPTION_KEY to stored rows,
# so a stale volume plus a rotated key is undecryptable data. CALDIY_PG_PERSIST=1
# bind-mounts deploy/.data/pgdata on the Apple Container path.
set -euo pipefail
cd "$(dirname "$0")/.."

DB_NAME=caldiy-db
MAIL_NAME=caldiy-mailhog
PG_IMAGE=postgres:16
# Multi-arch mirror of MailHog v1.0.1 - upstream mailhog/mailhog is amd64-only;
# same ref as compose.services.yml.
MAIL_IMAGE=jcalonso/mailhog:v1.0.1
COMPOSE_FILE="$PWD/deploy/compose.services.yml"

have_container() { command -v container >/dev/null 2>&1; }
have_compose() { docker compose version >/dev/null 2>&1; }

# ---- docker compose path ----
compose_args() {
  if [[ "${CALDIY_SERVICES_DB:-}" == "1" ]]; then echo "--profile db"; fi
}
compose_up() {
  # shellcheck disable=SC2046
  docker compose -f "$COMPOSE_FILE" $(compose_args) up -d --wait
  echo "services up (docker compose): mailhog :1025 (smtp) / :8025 (ui)$( [[ "${CALDIY_SERVICES_DB:-}" == "1" ]] && echo ', postgres :5432' )"
}
compose_down() {
  # shellcheck disable=SC2046
  docker compose -f "$COMPOSE_FILE" $(compose_args) down -v
  echo "services down"
}
compose_status() {
  docker compose -f "$COMPOSE_FILE" --profile db ps
  for port in 5432 1025 8025; do
    if (echo > "/dev/tcp/127.0.0.1/$port") >/dev/null 2>&1; then echo "port $port: open"; else echo "port $port: closed"; fi
  done
}

# ---- Apple Container path (macOS) ----
exists() { container inspect "$1" >/dev/null 2>&1; }

up() {
  container system status >/dev/null 2>&1 || container system start

  if exists "$DB_NAME"; then
    container start "$DB_NAME" >/dev/null 2>&1 || true # no-op when already running
  else
    local args=(-d --name "$DB_NAME" -p 5432:5432
      -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=calendso)
    if [[ "${CALDIY_PG_PERSIST:-}" == "1" ]]; then
      mkdir -p deploy/.data/pgdata
      args+=(-v "$PWD/deploy/.data/pgdata:/var/lib/postgresql/data")
    fi
    container run "${args[@]}" "$PG_IMAGE"
  fi

  if exists "$MAIL_NAME"; then
    container start "$MAIL_NAME" >/dev/null 2>&1 || true
  else
    container run -d --name "$MAIL_NAME" -p 1025:1025 -p 8025:8025 "$MAIL_IMAGE"
  fi

  # Readiness: a host TCP accept on 5432 means the FINAL postgres server - the
  # docker entrypoint's initdb temp server is unix-socket-only, so it can never
  # answer this probe. Budget = cal's CI health-retry budget (15 x 2s) with a 2x
  # margin for a cold image pull.
  echo "waiting for postgres on localhost:5432..."
  for _ in $(seq 1 30); do
    if nc -z localhost 5432 >/dev/null 2>&1; then
      echo "services up: postgres :5432, mailhog :1025 (smtp) / :8025 (ui)"
      return 0
    fi
    sleep 2
  done
  echo "postgres did not become ready within 60s - check: container logs $DB_NAME" >&2
  return 1
}

down() {
  container stop "$DB_NAME" "$MAIL_NAME" >/dev/null 2>&1 || true
  container delete "$DB_NAME" "$MAIL_NAME" >/dev/null 2>&1 || true
  echo "services down"
}

status() {
  container list
  for port in 5432 1025 8025; do
    if nc -z localhost "$port" >/dev/null 2>&1; then echo "port $port: open"; else echo "port $port: closed"; fi
  done
}

if ! have_container; then
  if ! have_compose; then
    echo "neither Apple Container (\`container\`) nor \`docker compose\` is available - install one; this script needs a container runtime to bring up mailhog (and postgres)" >&2
    exit 1
  fi
  case "${1:-}" in
    up) compose_up ;;
    down) compose_down ;;
    status) compose_status ;;
    *) echo "usage: $0 up|down|status" >&2; exit 2 ;;
  esac
  exit 0
fi

case "${1:-}" in
  up) up ;;
  down) down ;;
  status) status ;;
  *) echo "usage: $0 up|down|status" >&2; exit 2 ;;
esac
