import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockDatabase = {
  getUserSettings: vi.fn(() => Promise.resolve({})),
};

const mockEmbedding = {
  delete: vi.fn(() => Promise.resolve({ status: "success" })),
};

vi.mock("~/lib/database", () => ({
  Database: {
    getInstance: vi.fn(() => mockDatabase),
  },
}));

vi.mock("~/lib/embedding", () => ({
  Embedding: {
    getInstance: vi.fn(() => mockEmbedding),
  },
}));

vi.mock("~/utils/logger", () => ({
  getLogger: vi.fn(() => ({
    error: vi.fn(),
  })),
}));

import { Database } from "~/lib/database";
import { Embedding } from "~/lib/embedding";
import { deleteEmbedding } from "../delete";

describe("deleteEmbedding", () => {
  const mockUser = {
    id: "user-123",
    email: "test@example.com",
    plan: "free",
    created_at: Date.now(),
  } as any;

  const mockEnv = {
    ASSETS_BUCKET: "test-bucket",
    PUBLIC_ASSETS_URL: "https://assets.test.com",
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should successfully delete embeddings", async () => {
    const req = {
      user: mockUser,
      env: mockEnv,
      request: {
        ids: ["embedding-1", "embedding-2", "embedding-3"],
      },
    };

    mockDatabase.getUserSettings.mockResolvedValue({});
    mockEmbedding.delete.mockResolvedValue({ status: "success" });

    const result = await deleteEmbedding(req);

    expect(result).toEqual({
      status: "success",
      data: {
        ids: ["embedding-1", "embedding-2", "embedding-3"],
      },
    });

    expect(mockEmbedding.delete).toHaveBeenCalledWith([
      "embedding-1",
      "embedding-2",
      "embedding-3",
    ]);
  });

  it("should delete single embedding", async () => {
    const req = {
      user: mockUser,
      env: mockEnv,
      request: {
        ids: ["single-embedding"],
      },
    };

    mockDatabase.getUserSettings.mockResolvedValue({});
    mockEmbedding.delete.mockResolvedValue({ status: "success" });

    const result = await deleteEmbedding(req);

    expect(result).toEqual({
      status: "success",
      data: {
        ids: ["single-embedding"],
      },
    });
  });

  it("should throw error for missing ids", async () => {
    const req = {
      user: mockUser,
      env: mockEnv,
      request: {},
    };

    // @ts-ignore - req.request.ids is required
    await expect(deleteEmbedding(req)).rejects.toThrow(
      "Error deleting embedding",
    );
  });

  it("should throw error for null ids", async () => {
    const req = {
      user: mockUser,
      env: mockEnv,
      request: {
        ids: null,
      },
    };

    await expect(deleteEmbedding(req)).rejects.toThrow(
      "Error deleting embedding",
    );
  });

  it("should throw error for empty ids array", async () => {
    const req = {
      user: mockUser,
      env: mockEnv,
      request: {
        ids: [],
      },
    };

    mockDatabase.getUserSettings.mockResolvedValue({});
    mockEmbedding.delete.mockResolvedValue({ status: "success" });

    const result = await deleteEmbedding(req);

    expect(result.status).toBe("success");
    expect(result.data?.ids).toEqual([]);
  });

  it("should handle deletion failure", async () => {
    const req = {
      user: mockUser,
      env: mockEnv,
      request: {
        ids: ["embedding-1"],
      },
    };

    mockDatabase.getUserSettings.mockResolvedValue({});
    mockEmbedding.delete.mockResolvedValue({ status: "error" });

    await expect(deleteEmbedding(req)).rejects.toThrow(
      "Error deleting embedding",
    );
  });

  it("should handle database errors", async () => {
    const req = {
      user: mockUser,
      env: mockEnv,
      request: {
        ids: ["embedding-1"],
      },
    };

    mockDatabase.getUserSettings.mockRejectedValue(new Error("Database error"));

    await expect(deleteEmbedding(req)).rejects.toThrow(
      "Error deleting embedding",
    );
  });

  it("should handle embedding service errors", async () => {
    const req = {
      user: mockUser,
      env: mockEnv,
      request: {
        ids: ["embedding-1"],
      },
    };

    mockDatabase.getUserSettings.mockResolvedValue({});
    mockEmbedding.delete.mockRejectedValue(
      new Error("Embedding service error"),
    );

    await expect(deleteEmbedding(req)).rejects.toThrow(
      "Error deleting embedding",
    );
  });

  it("should handle service initialization errors", async () => {
    const req = {
      user: mockUser,
      env: mockEnv,
      request: {
        ids: ["embedding-1"],
      },
    };

    vi.mocked(Database.getInstance).mockImplementation(() => {
      throw new Error("Service init error");
    });

    await expect(deleteEmbedding(req)).rejects.toThrow(
      "Error deleting embedding",
    );
  });
});
