import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/utils/embeddings", () => ({
  chunkText: vi.fn(),
}));

vi.mock("~/utils/id", () => ({
  generateId: vi.fn(() => "generated-id"),
}));

const mockDatabase = {
  getEmbeddingIdByType: vi.fn(),
  insertEmbedding: vi.fn(),
  getUserSettings: vi.fn(() => Promise.resolve({})),
};

const mockEmbedding = {
  getNamespace: vi.fn(),
  generate: vi.fn(),
  insert: vi.fn(),
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

vi.mock("~/lib/chat/utils", () => ({
  sanitiseInput: vi.fn((input) => input),
}));

vi.mock("~/utils/logger", () => ({
  getLogger: vi.fn(() => ({
    error: vi.fn(),
  })),
}));

import { chunkText } from "~/utils/embeddings";
import { generateId } from "~/utils/id";
import { insertEmbedding } from "../insert";

describe("insertEmbedding", () => {
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
    mockDatabase.getEmbeddingIdByType.mockResolvedValue(null);
    mockDatabase.insertEmbedding.mockResolvedValue(undefined);
    mockDatabase.getUserSettings.mockResolvedValue({});
    mockEmbedding.getNamespace.mockReturnValue("default-namespace");
    mockEmbedding.generate.mockResolvedValue([{ id: "vec-1" }]);
    mockEmbedding.insert.mockResolvedValue({ status: "success", error: null });
    vi.mocked(chunkText).mockReturnValue(["single chunk"]);
    vi.mocked(generateId).mockReturnValue("generated-id");
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should successfully insert embedding for regular content", async () => {
    const req = {
      user: mockUser,
      env: mockEnv,
      request: {
        type: "document",
        content: "This is test content",
        id: "doc-123",
        metadata: { author: "test" },
        title: "Test Document",
        rag_options: { namespace: "custom-ns", chunkSize: 1000 },
      },
    };

    mockDatabase.insertEmbedding.mockResolvedValue(undefined);
    mockDatabase.getUserSettings.mockResolvedValue({});
    mockEmbedding.getNamespace.mockReturnValue("custom-ns");
    mockEmbedding.generate.mockResolvedValue([{ id: "vec-1" }]);
    mockEmbedding.insert.mockResolvedValue({ status: "success", error: null });

    const result = await insertEmbedding(req);

    expect(result).toEqual({
      status: "success",
      data: {
        id: "doc-123",
        metadata: { author: "test", title: "Test Document" },
        title: "Test Document",
        content: "This is test content",
        type: "document",
      },
    });

    expect(mockDatabase.insertEmbedding).toHaveBeenCalledWith(
      "doc-123",
      { author: "test", title: "Test Document" },
      "Test Document",
      "This is test content",
      "document",
    );
  });

  it("should handle blog type embeddings", async () => {
    const req = {
      user: mockUser,
      env: mockEnv,
      request: {
        type: "blog",
        content: "Blog post content",
        id: "blog-456",
        metadata: {},
        title: "Blog Post",
        rag_options: {},
      },
    };

    mockDatabase.getEmbeddingIdByType.mockResolvedValue("blog-456");
    mockDatabase.getUserSettings.mockResolvedValue({});
    mockEmbedding.generate.mockResolvedValue([{ id: "vec-2" }]);
    mockEmbedding.insert.mockResolvedValue({ status: "success", error: null });

    const result = await insertEmbedding(req);

    expect(result.status).toBe("success");
    expect(mockDatabase.getEmbeddingIdByType).toHaveBeenCalledWith(
      "blog-456",
      "blog",
    );
  });

  it("should throw error for missing type", async () => {
    const req = {
      user: mockUser,
      env: mockEnv,
      request: {
        content: "Content without type",
        id: "test-id",
        metadata: {},
        title: "Test",
        rag_options: {},
      },
    };

    // @ts-ignore - req.request.type is required
    await expect(insertEmbedding(req)).rejects.toThrow(
      "Error inserting embedding",
    );
  });

  it("should throw error for missing content", async () => {
    const req = {
      user: mockUser,
      env: mockEnv,
      request: {
        type: "document",
        id: "test-id",
        metadata: {},
        title: "Test",
        rag_options: {},
      },
    };

    // @ts-ignore - req.request.content is required
    await expect(insertEmbedding(req)).rejects.toThrow(
      "Error inserting embedding",
    );
  });

  it("should throw error for non-existent blog", async () => {
    const req = {
      user: mockUser,
      env: mockEnv,
      request: {
        type: "blog",
        content: "Blog content",
        id: "non-existent-blog",
        metadata: {},
        title: "Blog",
        rag_options: {},
      },
    };

    mockDatabase.getEmbeddingIdByType.mockResolvedValue(null);

    await expect(insertEmbedding(req)).rejects.toThrow(
      "Error inserting embedding",
    );
  });

  it("should handle chunked content", async () => {
    const req = {
      user: mockUser,
      env: mockEnv,
      request: {
        type: "document",
        content: "Long content that needs chunking",
        id: "long-doc",
        metadata: {},
        title: "Long Document",
        rag_options: { chunkSize: 100 },
      },
    };

    vi.mocked(chunkText).mockReturnValue(["Chunk 1", "Chunk 2"]);
    mockDatabase.insertEmbedding.mockResolvedValue(undefined);
    mockDatabase.getUserSettings.mockResolvedValue({});
    mockEmbedding.generate.mockResolvedValue([{ id: "vec-1" }]);
    mockEmbedding.insert.mockResolvedValue({ status: "success", error: null });

    const result = await insertEmbedding(req);

    expect(result.status).toBe("success");
    expect(vi.mocked(chunkText)).toHaveBeenCalledWith(
      "Long content that needs chunking",
      100,
    );
    expect(mockDatabase.insertEmbedding).toHaveBeenCalledTimes(3);
  });

  it("should generate unique ID when not provided", async () => {
    const req = {
      user: mockUser,
      env: mockEnv,
      request: {
        type: "document",
        content: "Content without ID",
        metadata: {},
        title: "Test",
        rag_options: {},
      },
    };

    mockDatabase.insertEmbedding.mockResolvedValue(undefined);
    mockDatabase.getUserSettings.mockResolvedValue({});
    mockEmbedding.generate.mockResolvedValue([{ id: "vec-1" }]);
    mockEmbedding.insert.mockResolvedValue({ status: "success", error: null });

    // @ts-ignore - req.request.id is required
    const result = await insertEmbedding(req);

    expect(result.status).toBe("success");
    expect(result.data?.id).toMatch(/^\d+-generated-id$/);
  });

  it("should handle embedding insertion failure", async () => {
    const req = {
      user: mockUser,
      env: mockEnv,
      request: {
        type: "document",
        content: "Test content",
        id: "test-id",
        metadata: {},
        title: "Test",
        rag_options: {},
      },
    };

    mockDatabase.insertEmbedding.mockResolvedValue(undefined);
    mockDatabase.getUserSettings.mockResolvedValue({});
    mockEmbedding.generate.mockResolvedValue([{ id: "vec-1" }]);
    mockEmbedding.insert.mockResolvedValue({ status: "error" });

    await expect(insertEmbedding(req)).rejects.toThrow(
      "Error inserting embedding",
    );
  });

  it("should handle database errors gracefully", async () => {
    const req = {
      user: mockUser,
      env: mockEnv,
      request: {
        type: "document",
        content: "Test content",
        id: "test-id",
        metadata: {},
        title: "Test",
        rag_options: {},
      },
    };

    mockDatabase.insertEmbedding.mockRejectedValue(new Error("Database error"));

    await expect(insertEmbedding(req)).rejects.toThrow(
      "Error inserting embedding",
    );
  });
});
