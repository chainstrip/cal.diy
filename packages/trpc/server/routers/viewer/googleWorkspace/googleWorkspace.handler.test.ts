import { describe, it, expect, vi, beforeEach } from "vitest";

import type { TrpcSessionUser } from "../../../types";

// Mock prisma
vi.mock("@calcom/prisma", () => ({
  prisma: {
    credential: {
      findFirst: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

// Mock getAppKeysFromSlug
vi.mock("@calcom/app-store/_utils/getAppKeysFromSlug", () => ({
  default: vi.fn(),
}));

// Replace only the transport: the real @googleapis/admin client builds the Directory
// request and hands it to the auth client's `request`, which is where the network would go.
const { directoryRequest } = vi.hoisted(() => ({ directoryRequest: vi.fn() }));
vi.mock("google-auth-library", () => ({
  OAuth2Client: class FakeOAuth2Client {
    credentials: unknown = null;
    constructor(public clientId: string, public clientSecret: string) {}
    setCredentials(credentials: unknown) {
      this.credentials = credentials;
    }
    getRequestHeaders() {
      return {};
    }
    request(options: unknown) {
      return directoryRequest(options);
    }
  },
}));

// Factory function to create mock user context
const createMockContext = (overrides: Partial<TrpcSessionUser> = {}) => ({
  ctx: {
    user: {
      id: 1,
      email: "test@example.com",
      username: "testuser",
      ...overrides,
    } as NonNullable<TrpcSessionUser>,
  },
});

// Factory function to create mock credential matching Prisma's Credential model
const createMockCredential = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  type: "google_workspace_directory",
  key: {
    refresh_token: "mock_refresh_token",
    access_token: "mock_access_token",
  },
  userId: 1,
  teamId: null,
  appId: null,
  subscriptionId: null,
  paymentStatus: null,
  billingCycleStart: null,
  invalid: false,
  delegationCredentialId: null,
  ...overrides,
});

describe("googleWorkspace.handler", () => {
  let prisma: Awaited<typeof import("@calcom/prisma")>["prisma"];
  let getAppKeysFromSlug: Awaited<typeof import("@calcom/app-store/_utils/getAppKeysFromSlug")>["default"];
  let handlers: typeof import("./googleWorkspace.handler");

  beforeEach(async () => {
    vi.clearAllMocks();
    ({ prisma } = await import("@calcom/prisma"));
    getAppKeysFromSlug = (await import("@calcom/app-store/_utils/getAppKeysFromSlug")).default;
    handlers = await import("./googleWorkspace.handler");
  });

  describe("checkForGWorkspace", () => {
    it("queries credentials filtered by current user id", async () => {
      const mockContext = createMockContext({ id: 42 });
      vi.mocked(prisma.credential.findFirst).mockResolvedValue(null);

      await handlers.checkForGWorkspace(mockContext);

      expect(prisma.credential.findFirst).toHaveBeenCalledWith({
        where: {
          type: "google_workspace_directory",
          userId: 42,
        },
      });
    });

    it("returns credential id when found", async () => {
      const mockCredential = createMockCredential({ id: 123 });
      vi.mocked(prisma.credential.findFirst).mockResolvedValue(mockCredential);

      const result = await handlers.checkForGWorkspace(createMockContext());

      expect(result).toEqual({ id: 123 });
    });

    it("returns undefined id when no credential found", async () => {
      vi.mocked(prisma.credential.findFirst).mockResolvedValue(null);

      const result = await handlers.checkForGWorkspace(createMockContext());

      expect(result).toEqual({ id: undefined });
    });
  });

  describe("getUsersFromGWorkspace", () => {
    it("queries credentials filtered by current user id", async () => {
      const mockContext = createMockContext({ id: 99 });

      vi.mocked(getAppKeysFromSlug).mockResolvedValue({
        client_id: "mock_client_id",
        client_secret: "mock_client_secret",
      });
      vi.mocked(prisma.credential.findFirst).mockResolvedValue(null);

      await expect(handlers.getUsersFromGWorkspace(mockContext)).rejects.toThrow(
        "No workspace credentials found"
      );

      expect(prisma.credential.findFirst).toHaveBeenCalledWith({
        where: {
          type: "google_workspace_directory",
          userId: 99,
        },
      });
    });

    it("lists the workspace users through the Directory API and returns their primary emails", async () => {
      vi.mocked(getAppKeysFromSlug).mockResolvedValue({
        client_id: "mock_client_id",
        client_secret: "mock_client_secret",
      });
      vi.mocked(prisma.credential.findFirst).mockResolvedValue(createMockCredential());
      directoryRequest.mockResolvedValue({
        data: {
          users: [
            { primaryEmail: "alice@acme.example", name: { fullName: "Alice" } },
            { primaryEmail: "bob@acme.example", name: { fullName: "Bob" } },
          ],
        },
      });

      const emails = await handlers.getUsersFromGWorkspace(createMockContext({ id: 7 }));

      expect(emails).toEqual(["alice@acme.example", "bob@acme.example"]);
      expect(directoryRequest).toHaveBeenCalledTimes(1);
      const options = directoryRequest.mock.calls[0][0] as { url: string; method: string; params: Record<string, unknown> };
      expect(options.method).toBe("GET");
      expect(options.url).toBe("https://admin.googleapis.com/admin/directory/v1/users");
      expect(options.params).toEqual(expect.objectContaining({ maxResults: 200, customer: "my_customer" }));
    });

    it("returns an empty list when the directory has no users", async () => {
      vi.mocked(getAppKeysFromSlug).mockResolvedValue({
        client_id: "mock_client_id",
        client_secret: "mock_client_secret",
      });
      vi.mocked(prisma.credential.findFirst).mockResolvedValue(createMockCredential());
      directoryRequest.mockResolvedValue({ data: {} });

      await expect(handlers.getUsersFromGWorkspace(createMockContext())).resolves.toEqual([]);
    });

    it("throws error when Google client_id is missing", async () => {
      vi.mocked(getAppKeysFromSlug).mockResolvedValue({});

      await expect(handlers.getUsersFromGWorkspace(createMockContext())).rejects.toThrow(
        "Google client_id missing."
      );
    });

    it("throws error when no credentials found for user", async () => {
      vi.mocked(getAppKeysFromSlug).mockResolvedValue({
        client_id: "mock_client_id",
        client_secret: "mock_client_secret",
      });
      vi.mocked(prisma.credential.findFirst).mockResolvedValue(null);

      await expect(handlers.getUsersFromGWorkspace(createMockContext())).rejects.toThrow(
        "No workspace credentials found"
      );
    });
  });

  describe("removeCurrentGoogleWorkspaceConnection", () => {
    it("deletes credentials filtered by current user id", async () => {
      const mockContext = createMockContext({ id: 55 });
      vi.mocked(prisma.credential.deleteMany).mockResolvedValue({ count: 1 });

      await handlers.removeCurrentGoogleWorkspaceConnection(mockContext);

      expect(prisma.credential.deleteMany).toHaveBeenCalledWith({
        where: {
          type: "google_workspace_directory",
          userId: 55,
        },
      });
    });

    it("returns count of deleted credentials", async () => {
      vi.mocked(prisma.credential.deleteMany).mockResolvedValue({ count: 2 });

      const result = await handlers.removeCurrentGoogleWorkspaceConnection(createMockContext());

      expect(result).toEqual({ deleted: 2 });
    });
  });
});
