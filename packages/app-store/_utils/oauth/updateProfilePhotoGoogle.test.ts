import type { OAuth2Client } from "googleapis-common";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  uploadAvatar: vi.fn(),
  resizeBase64Image: vi.fn(),
  updateAvatar: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("@calcom/lib/logger", () => ({
  default: {
    info: vi.fn(),
    error: (...args: unknown[]) => mocks.loggerError(...args),
    getSubLogger: () => ({ info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }),
  },
}));
vi.mock("@calcom/lib/server/avatar", () => ({
  uploadAvatar: (...args: unknown[]) => mocks.uploadAvatar(...args),
}));
vi.mock("@calcom/lib/server/resizeBase64Image", () => ({
  resizeBase64Image: (...args: unknown[]) => mocks.resizeBase64Image(...args),
}));
vi.mock("@calcom/prisma", () => ({ default: {} }));
vi.mock("@calcom/features/users/repositories/UserRepository", () => ({
  UserRepository: class {
    updateAvatar(args: unknown) {
      return mocks.updateAvatar(args);
    }
  },
}));

import { updateProfilePhotoGoogle } from "./updateProfilePhotoGoogle";

/**
 * The real @googleapis/oauth2 client builds the userinfo request and hands it to the
 * auth client's `request`. Only that transport is faked here.
 */
function fakeAuthClient(picture: string | undefined) {
  const request = vi.fn(async () => ({ data: picture ? { picture, email: "user@example.com" } : {} }));
  return { client: { request, getRequestHeaders: async () => ({}) } as unknown as OAuth2Client, request };
}

describe("updateProfilePhotoGoogle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.updateAvatar.mockResolvedValue(undefined);
  });

  it("fetches the Google userinfo picture and stores it as the user's avatar url", async () => {
    const { client, request } = fakeAuthClient("https://lh3.googleusercontent.com/a/photo=s96-c");

    await updateProfilePhotoGoogle(client, 15);

    expect(request).toHaveBeenCalledTimes(1);
    const options = request.mock.calls[0][0] as { url: string; method: string };
    expect(options.method).toBe("GET");
    expect(options.url).toBe("https://www.googleapis.com/oauth2/v2/userinfo");
    expect(mocks.updateAvatar).toHaveBeenCalledWith({
      id: 15,
      avatarUrl: "https://lh3.googleusercontent.com/a/photo=s96-c",
    });
    expect(mocks.uploadAvatar).not.toHaveBeenCalled();
    expect(mocks.loggerError).not.toHaveBeenCalled();
  });

  it("resizes and uploads an inline base64 picture before storing its url", async () => {
    const { client } = fakeAuthClient("data:image/png;base64,iVBORw0KGgo=");
    mocks.resizeBase64Image.mockResolvedValue("data:image/png;base64,resized");
    mocks.uploadAvatar.mockResolvedValue("/api/avatar/uploaded.png");

    await updateProfilePhotoGoogle(client, 16);

    expect(mocks.resizeBase64Image).toHaveBeenCalledWith("data:image/png;base64,iVBORw0KGgo=");
    expect(mocks.uploadAvatar).toHaveBeenCalledWith({ avatar: "data:image/png;base64,resized", userId: 16 });
    expect(mocks.updateAvatar).toHaveBeenCalledWith({ id: 16, avatarUrl: "/api/avatar/uploaded.png" });
  });

  it("leaves the avatar untouched when Google returns no picture", async () => {
    const { client } = fakeAuthClient(undefined);

    await updateProfilePhotoGoogle(client, 17);

    expect(mocks.updateAvatar).not.toHaveBeenCalled();
    expect(mocks.loggerError).not.toHaveBeenCalled();
  });

  it("logs and swallows a failing userinfo request", async () => {
    const request = vi.fn(async () => {
      throw new Error("invalid_grant");
    });
    const client = { request, getRequestHeaders: async () => ({}) } as unknown as OAuth2Client;

    await expect(updateProfilePhotoGoogle(client, 18)).resolves.toBeUndefined();

    expect(mocks.updateAvatar).not.toHaveBeenCalled();
    expect(mocks.loggerError).toHaveBeenCalledTimes(1);
  });
});
