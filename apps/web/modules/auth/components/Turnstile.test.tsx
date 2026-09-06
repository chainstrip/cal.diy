import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@calcom/lib/constants", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@calcom/lib/constants")>()),
  CLOUDFLARE_SITE_ID: "1x00000000000000000000AA",
}));

import TurnstileWidget from "./Turnstile";

describe("TurnstileWidget", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    document.querySelectorAll('script[src*="challenges.cloudflare.com"]').forEach((s) => s.remove());
  });

  it("mounts the Cloudflare widget container and loads the Turnstile script", () => {
    const { container } = render(<TurnstileWidget onVerify={vi.fn()} />);

    expect(container.firstElementChild?.tagName).toBe("DIV");
    const script = document.querySelector<HTMLScriptElement>('script[src*="challenges.cloudflare.com/turnstile"]');
    expect(script).not.toBeNull();
    expect(script?.src).toContain("/turnstile/v0/api.js");
  });

  it("renders nothing during e2e runs", () => {
    vi.stubEnv("NEXT_PUBLIC_IS_E2E", "1");

    const { container } = render(<TurnstileWidget onVerify={vi.fn()} />);

    expect(container).toBeEmptyDOMElement();
  });
});
