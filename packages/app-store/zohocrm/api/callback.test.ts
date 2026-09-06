import type { NextApiRequest, NextApiResponse } from "next";
import { createMocks } from "node-mocks-http";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { WEBAPP_URL } from "@calcom/lib/constants";

const mocks = vi.hoisted(() => ({
  axios: vi.fn(),
  getAppKeysFromSlug: vi.fn(),
  createOAuthAppCredential: vi.fn(),
}));

vi.mock("axios", () => ({ default: mocks.axios }));
vi.mock("../../_utils/getAppKeysFromSlug", () => ({ default: mocks.getAppKeysFromSlug }));
vi.mock("../../_utils/oauth/createOAuthAppCredential", () => ({ default: mocks.createOAuthAppCredential }));

import handler from "./callback";

type SessionRequest = NextApiRequest & { session?: { user?: { id: number } } };

function request(query: Record<string, string>) {
  const { req, res } = createMocks<SessionRequest, NextApiResponse>({ method: "GET", query });
  req.session = { user: { id: 42 } };
  return { req, res };
}

describe("zohocrm oauth callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAppKeysFromSlug.mockResolvedValue({ client_id: "zoho-client", client_secret: "zoho secret&more" });
    mocks.axios.mockResolvedValue({
      data: { access_token: "at", refresh_token: "rt", expires_in: 3600, api_domain: "https://www.zohoapis.com" },
    });
    mocks.createOAuthAppCredential.mockResolvedValue(undefined);
  });

  it("exchanges the code as a form-encoded token request and stores the credential", async () => {
    const { req, res } = request({ code: "1000.abc.def", "accounts-server": "https://accounts.zoho.eu" });

    await handler(req, res);

    expect(mocks.axios).toHaveBeenCalledTimes(1);
    const call = mocks.axios.mock.calls[0][0];
    expect(call.method).toBe("post");
    expect(call.url).toBe("https://accounts.zoho.eu/oauth/v2/token");
    expect(call.headers["Content-Type"]).toBe("application/x-www-form-urlencoded;charset=utf-8");
    const redirectUri = `${WEBAPP_URL}/api/integrations/zohocrm/callback`;
    expect(call.data).toBe(
      [
        "grant_type=authorization_code",
        "client_id=zoho-client",
        `client_secret=${encodeURIComponent("zoho secret&more")}`,
        `redirect_uri=${encodeURIComponent(redirectUri)}`,
        `code=${encodeURIComponent("1000.abc.def")}`,
      ].join("&")
    );

    expect(mocks.createOAuthAppCredential).toHaveBeenCalledWith(
      { appId: "zohocrm", type: "zohocrm_crm" },
      expect.objectContaining({
        access_token: "at",
        refresh_token: "rt",
        accountServer: "https://accounts.zoho.eu",
        expiryDate: expect.any(Number),
      }),
      req
    );
    expect(res._getRedirectUrl()).toBe("/apps/installed/other?hl=zohocrm");
  });

  it("refuses an accounts-server that is not a Zoho data center", async () => {
    const { req, res } = request({ code: "1000.abc", "accounts-server": "https://accounts.evil.example" });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(400);
    expect(mocks.axios).not.toHaveBeenCalled();
  });

  it("requires a logged-in user", async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { code: "1000.abc", "accounts-server": "https://accounts.zoho.com" },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(401);
    expect(mocks.axios).not.toHaveBeenCalled();
  });
});
