import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { handleUnshareConversation } from "../unshareConversation";

vi.mock("~/modules/conversations/application/manager", () => ({
  ConversationManager: {
    getInstance: vi.fn(),
  },
}));

const mockEnv = {
  DB: "test-db",
};

const mockUser = {
  id: "user-123",
  email: "test@example.com",
};

let mockServiceContext: any;

describe("handleUnshareConversation", () => {
  let mockConversationManager: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    const { ConversationManager } = await import("~/modules/conversations/application/manager");

    mockConversationManager = {
      unshareConversation: vi.fn(),
    };

    mockServiceContext = {
      env: mockEnv,
      user: mockUser,
      ensureDatabase: vi.fn(),
      database: {} as any,
      repositories: {} as any,
      requireUser: vi.fn().mockReturnValue(mockUser),
    };

    vi.mocked(ConversationManager.getInstance).mockReturnValue(mockConversationManager);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("parameter validation", () => {
    it("should throw error for missing user", async () => {
      mockServiceContext.requireUser.mockImplementationOnce(() => {
        throw new Error("Authentication required");
      });

      await expect(() =>
        handleUnshareConversation(mockServiceContext, "completion-123"),
      ).rejects.toThrow("Authentication required");
    });
  });
});
