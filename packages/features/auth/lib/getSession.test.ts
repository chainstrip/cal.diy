import type { NextApiRequest } from "next";
import { createMocks } from "node-mocks-http";
import { beforeEach, describe, expect, it } from "vitest";

import { getSession } from "./getSession";

describe("getSession", () => {
  beforeEach(() => {
    fetchMock.resetMocks();
  });

  it("returns the session served by /api/auth/session, forwarding the request cookies", async () => {
    const session = {
      user: { id: 7, email: "user@example.com", name: "Test User" },
      expires: "2099-01-01T00:00:00.000Z",
      hasValidLicense: true,
      upId: "usr-7",
    };
    fetchMock.mockResponseOnce(JSON.stringify(session), {
      headers: { "content-type": "application/json" },
    });

    const { req } = createMocks<NextApiRequest>({
      method: "GET",
      headers: { cookie: "next-auth.session-token=abc" },
    });

    const result = await getSession({ req });

    expect(result).toEqual(session);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/api\/auth\/session$/);
    expect((init?.headers as Record<string, string>).cookie).toBe("next-auth.session-token=abc");
  });

  it("returns null when the session endpoint answers with an empty session", async () => {
    fetchMock.mockResponseOnce(JSON.stringify({}), {
      headers: { "content-type": "application/json" },
    });

    const { req } = createMocks<NextApiRequest>({ method: "GET" });

    const result = await getSession({ req });

    expect(result).toBeNull();
  });
});
