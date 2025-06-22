import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { StorageService } from "~/lib/storage";
import { RepositoryManager } from "~/repositories";
import { AssistantError } from "~/utils/errors";
import { generateImageFromDrawing } from "../create";

vi.mock("~/repositories", () => ({
  RepositoryManager: {
    getInstance: vi.fn(),
  },
}));

vi.mock("~/lib/storage", () => ({
  StorageService: vi.fn(),
}));

vi.mock("~/utils/id", () => ({
  generateId: vi.fn(() => "test-drawing-id"),
}));

vi.mock("~/constants/app", () => ({
  gatewayId: "test-gateway-id",
}));

vi.mock("~/lib/prompts", () => ({
  drawingDescriptionPrompt: vi.fn(() => "Describe this drawing in detail"),
}));

const mockAppDataRepo = {
  createAppDataWithItem: vi.fn(),
};

const mockStorageService = {
  uploadObject: vi.fn(),
};

const mockConversationManager = {
  add: vi.fn(),
} as any;

const mockUser = {
  id: 123,
  email: "test@example.com",
  username: "testuser",
  created_at: "2023-01-01T00:00:00Z",
  updated_at: "2023-01-01T00:00:00Z",
} as any;

const mockEnv = {
  AI: {
    run: vi.fn(),
  },
  ASSETS_BUCKET: "test-bucket",
  PUBLIC_ASSETS_URL: "https://assets.example.com",
  DATABASE_URL: "test-url",
  API_KEY: "test-key",
} as any;

describe("generateImageFromDrawing", () => {
  beforeEach(() => {
    vi.mocked(RepositoryManager.getInstance).mockReturnValue({
      appData: mockAppDataRepo,
    } as any);

    vi.mocked(StorageService).mockImplementation(
      () => mockStorageService as any,
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should throw AssistantError when drawing is missing", async () => {
    await expect(
      generateImageFromDrawing({
        env: mockEnv,
        request: {},
        user: mockUser,
      }),
    ).rejects.toThrow(AssistantError);

    await expect(
      generateImageFromDrawing({
        env: mockEnv,
        request: {},
        user: mockUser,
      }),
    ).rejects.toThrow("Missing drawing");
  });

  it("should successfully generate image from drawing", async () => {
    const mockDrawing = new Blob(["fake-image-data"], { type: "image/png" });
    const mockArrayBuffer = new ArrayBuffer(100);
    vi.spyOn(mockDrawing, "arrayBuffer").mockResolvedValue(mockArrayBuffer);

    const mockDescriptionResponse = {
      description: "A beautiful landscape with mountains",
    };

    const mockPaintingBlob = new Blob(["fake-painting-data"], {
      type: "image/png",
    });
    const mockPaintingArrayBuffer = new ArrayBuffer(200);
    vi.spyOn(mockPaintingBlob, "arrayBuffer").mockResolvedValue(
      mockPaintingArrayBuffer,
    );

    global.Response = vi.fn().mockImplementation((blob) => ({
      arrayBuffer: () =>
        blob.arrayBuffer?.() || Promise.resolve(mockPaintingArrayBuffer),
    })) as any;

    mockEnv.AI.run
      .mockResolvedValueOnce(mockDescriptionResponse)
      .mockResolvedValueOnce(mockPaintingBlob);

    mockStorageService.uploadObject
      .mockResolvedValueOnce(
        "https://assets.example.com/drawings/test-drawing-id/image.png",
      )
      .mockResolvedValueOnce(
        "https://assets.example.com/drawings/test-drawing-id/painting.png",
      );

    mockAppDataRepo.createAppDataWithItem.mockResolvedValue({
      id: "app-data-123",
    });

    const result = await generateImageFromDrawing({
      env: mockEnv,
      request: { drawing: mockDrawing },
      user: mockUser,
    });

    expect(mockEnv.AI.run).toHaveBeenCalledTimes(2);
    expect(mockEnv.AI.run).toHaveBeenNthCalledWith(
      1,
      "@cf/llava-hf/llava-1.5-7b-hf",
      {
        prompt: "Describe this drawing in detail",
        image: expect.any(Array),
      },
      {
        gateway: {
          id: "test-gateway-id",
          skipCache: false,
          cacheTtl: 3360,
          metadata: {
            email: "test@example.com",
          },
        },
      },
    );

    expect(mockEnv.AI.run).toHaveBeenNthCalledWith(
      2,
      "@cf/runwayml/stable-diffusion-v1-5-img2img",
      {
        prompt: "A beautiful landscape with mountains",
        image: expect.any(Array),
        guidance: 8,
        strength: 0.85,
        num_inference_steps: 50,
      },
      {
        gateway: {
          id: "test-gateway-id",
          skipCache: false,
          cacheTtl: 3360,
          metadata: {
            email: "test@example.com",
          },
        },
      },
    );

    expect(mockStorageService.uploadObject).toHaveBeenCalledTimes(2);
    expect(mockAppDataRepo.createAppDataWithItem).toHaveBeenCalledWith(
      123,
      "drawings",
      "test-drawing-id",
      "drawing",
      {
        description: "A beautiful landscape with mountains",
        drawingUrl:
          "https://assets.example.com/drawings/test-drawing-id/image.png",
        paintingUrl:
          "https://assets.example.com/drawings/test-drawing-id/painting.png",
        drawingKey: "drawings/test-drawing-id/image.png",
        paintingKey: "drawings/test-drawing-id/painting.png",
      },
    );

    expect(result).toEqual({
      status: "success",
      app_data_id: "app-data-123",
      completion_id: "test-drawing-id",
      data: {
        description: "A beautiful landscape with mountains",
        drawingUrl:
          "https://assets.example.com/drawings/test-drawing-id/image.png",
        paintingUrl:
          "https://assets.example.com/drawings/test-drawing-id/painting.png",
        drawingKey: "drawings/test-drawing-id/image.png",
        paintingKey: "drawings/test-drawing-id/painting.png",
      },
    });
  });

  it("should use provided drawingId when available", async () => {
    const mockDrawing = new Blob(["fake-image-data"], { type: "image/png" });
    const mockArrayBuffer = new ArrayBuffer(100);
    vi.spyOn(mockDrawing, "arrayBuffer").mockResolvedValue(mockArrayBuffer);

    const mockDescriptionResponse = { description: "Test description" };
    const mockPaintingBlob = new Blob(["fake-painting-data"], {
      type: "image/png",
    });

    global.Response = vi.fn().mockImplementation(() => ({
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(200)),
    })) as any;

    mockEnv.AI.run
      .mockResolvedValueOnce(mockDescriptionResponse)
      .mockResolvedValueOnce(mockPaintingBlob);

    mockStorageService.uploadObject.mockResolvedValue(
      "https://example.com/test.png",
    );
    mockAppDataRepo.createAppDataWithItem.mockResolvedValue({
      id: "app-data-123",
    });

    await generateImageFromDrawing({
      env: mockEnv,
      request: {
        drawing: mockDrawing,
        drawingId: "custom-drawing-id",
      },
      user: mockUser,
    });

    expect(mockAppDataRepo.createAppDataWithItem).toHaveBeenCalledWith(
      123,
      "drawings",
      "custom-drawing-id",
      "drawing",
      expect.any(Object),
    );
  });

  it("should use existingDrawingId when provided", async () => {
    const mockDrawing = new Blob(["fake-image-data"], { type: "image/png" });
    const mockArrayBuffer = new ArrayBuffer(100);
    vi.spyOn(mockDrawing, "arrayBuffer").mockResolvedValue(mockArrayBuffer);

    const mockDescriptionResponse = { description: "Test description" };
    const mockPaintingBlob = new Blob(["fake-painting-data"], {
      type: "image/png",
    });

    global.Response = vi.fn().mockImplementation(() => ({
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(200)),
    })) as any;

    mockEnv.AI.run
      .mockResolvedValueOnce(mockDescriptionResponse)
      .mockResolvedValueOnce(mockPaintingBlob);

    mockStorageService.uploadObject.mockResolvedValue(
      "https://example.com/test.png",
    );
    mockAppDataRepo.createAppDataWithItem.mockResolvedValue({
      id: "app-data-123",
    });

    await generateImageFromDrawing({
      env: mockEnv,
      request: { drawing: mockDrawing },
      user: mockUser,
      existingDrawingId: "existing-drawing-id",
    });

    expect(mockAppDataRepo.createAppDataWithItem).toHaveBeenCalledWith(
      123,
      "drawings",
      "existing-drawing-id",
      "drawing",
      expect.any(Object),
    );
  });

  it("should handle conversation manager integration", async () => {
    const mockDrawing = new Blob(["fake-image-data"], { type: "image/png" });
    const mockArrayBuffer = new ArrayBuffer(100);
    vi.spyOn(mockDrawing, "arrayBuffer").mockResolvedValue(mockArrayBuffer);

    const mockDescriptionResponse = { description: "A beautiful sunset" };
    const mockPaintingBlob = new Blob(["fake-painting-data"], {
      type: "image/png",
    });

    global.Response = vi.fn().mockImplementation(() => ({
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(200)),
    })) as any;

    mockEnv.AI.run
      .mockResolvedValueOnce(mockDescriptionResponse)
      .mockResolvedValueOnce(mockPaintingBlob);

    mockStorageService.uploadObject.mockResolvedValue(
      "https://example.com/test.png",
    );
    mockAppDataRepo.createAppDataWithItem.mockResolvedValue({
      id: "app-data-123",
    });

    mockConversationManager.add
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ status: "conversation_success" });

    const result = await generateImageFromDrawing({
      env: mockEnv,
      request: { drawing: mockDrawing },
      user: mockUser,
      conversationManager: mockConversationManager,
    });

    expect(mockConversationManager.add).toHaveBeenCalledTimes(2);
    expect(mockConversationManager.add).toHaveBeenNthCalledWith(
      1,
      "test-drawing-id",
      {
        role: "user",
        content: "Generate a drawing with this prompt: A beautiful sunset",
        app: "drawings",
      },
    );

    expect(mockConversationManager.add).toHaveBeenNthCalledWith(
      2,
      "test-drawing-id",
      {
        role: "assistant",
        name: "drawing_generate",
        content: "A beautiful sunset",
        data: expect.objectContaining({
          drawingUrl: expect.stringContaining("image.png"),
          paintingUrl: expect.stringContaining("painting.png"),
        }),
      },
    );

    expect(result.status).toBe("success");
    // @ts-ignore - app_data_id exists on the returned object in tests
    expect(result.app_data_id).toBe("app-data-123");
  });

  it("should handle missing description gracefully", async () => {
    const mockDrawing = new Blob(["fake-image-data"], { type: "image/png" });
    const mockArrayBuffer = new ArrayBuffer(100);
    vi.spyOn(mockDrawing, "arrayBuffer").mockResolvedValue(mockArrayBuffer);

    const mockDescriptionResponse = {};
    const mockPaintingBlob = new Blob(["fake-painting-data"], {
      type: "image/png",
    });

    global.Response = vi.fn().mockImplementation(() => ({
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(200)),
    })) as any;

    mockEnv.AI.run
      .mockResolvedValueOnce(mockDescriptionResponse)
      .mockResolvedValueOnce(mockPaintingBlob);

    mockStorageService.uploadObject.mockResolvedValue(
      "https://example.com/test.png",
    );
    mockAppDataRepo.createAppDataWithItem.mockResolvedValue({
      id: "app-data-123",
    });

    const result = await generateImageFromDrawing({
      env: mockEnv,
      request: { drawing: mockDrawing },
      user: mockUser,
    });

    expect(mockEnv.AI.run).toHaveBeenNthCalledWith(
      2,
      "@cf/runwayml/stable-diffusion-v1-5-img2img",
      expect.objectContaining({
        prompt: "Convert this drawing into a painting.",
      }),
      expect.any(Object),
    );

    expect(result.data.description).toBe("Untitled drawing");
  });

  it("should throw AssistantError when drawing upload fails", async () => {
    const mockDrawing = new Blob(["fake-image-data"], { type: "image/png" });
    const mockArrayBuffer = new ArrayBuffer(100);
    vi.spyOn(mockDrawing, "arrayBuffer").mockResolvedValue(mockArrayBuffer);

    mockStorageService.uploadObject.mockRejectedValue(
      new Error("Upload failed"),
    );

    await expect(
      generateImageFromDrawing({
        env: mockEnv,
        request: { drawing: mockDrawing },
        user: mockUser,
      }),
    ).rejects.toThrow(AssistantError);

    await expect(
      generateImageFromDrawing({
        env: mockEnv,
        request: { drawing: mockDrawing },
        user: mockUser,
      }),
    ).rejects.toThrow("Error uploading drawing");
  });

  it("should throw AssistantError when painting upload fails", async () => {
    const mockDrawing = new Blob(["fake-image-data"], { type: "image/png" });
    const mockArrayBuffer = new ArrayBuffer(100);
    vi.spyOn(mockDrawing, "arrayBuffer").mockResolvedValue(mockArrayBuffer);

    const mockDescriptionResponse = { description: "Test description" };
    const mockPaintingBlob = new Blob(["fake-painting-data"], {
      type: "image/png",
    });

    global.Response = vi.fn().mockImplementation(() => ({
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(200)),
    })) as any;

    mockEnv.AI.run
      .mockResolvedValueOnce(mockDescriptionResponse)
      .mockResolvedValueOnce(mockPaintingBlob);

    mockStorageService.uploadObject
      .mockResolvedValueOnce("https://example.com/drawing.png")
      .mockRejectedValueOnce(new Error("Painting upload failed"));

    await expect(
      generateImageFromDrawing({
        env: mockEnv,
        request: { drawing: mockDrawing },
        user: mockUser,
      }),
    ).rejects.toThrow(AssistantError);
  });

  it("should handle AI description generation errors", async () => {
    const mockDrawing = new Blob(["fake-image-data"], { type: "image/png" });
    const mockArrayBuffer = new ArrayBuffer(100);
    vi.spyOn(mockDrawing, "arrayBuffer").mockResolvedValue(mockArrayBuffer);

    mockStorageService.uploadObject.mockResolvedValue(
      "https://example.com/drawing.png",
    );
    mockEnv.AI.run.mockRejectedValue(new Error("AI service unavailable"));

    await expect(
      generateImageFromDrawing({
        env: mockEnv,
        request: { drawing: mockDrawing },
        user: mockUser,
      }),
    ).rejects.toThrow("AI service unavailable");
  });

  it("should handle AI painting generation errors", async () => {
    const mockDrawing = new Blob(["fake-image-data"], { type: "image/png" });
    const mockArrayBuffer = new ArrayBuffer(100);
    vi.spyOn(mockDrawing, "arrayBuffer").mockResolvedValue(mockArrayBuffer);

    const mockDescriptionResponse = { description: "Test description" };

    mockEnv.AI.run
      .mockResolvedValueOnce(mockDescriptionResponse)
      .mockRejectedValueOnce(new Error("Painting generation failed"));

    mockStorageService.uploadObject.mockResolvedValue(
      "https://example.com/drawing.png",
    );

    await expect(
      generateImageFromDrawing({
        env: mockEnv,
        request: { drawing: mockDrawing },
        user: mockUser,
      }),
    ).rejects.toThrow("Painting generation failed");
  });

  it("should handle repository errors gracefully", async () => {
    const mockDrawing = new Blob(["fake-image-data"], { type: "image/png" });
    const mockArrayBuffer = new ArrayBuffer(100);
    vi.spyOn(mockDrawing, "arrayBuffer").mockResolvedValue(mockArrayBuffer);

    const mockDescriptionResponse = { description: "Test description" };
    const mockPaintingBlob = new Blob(["fake-painting-data"], {
      type: "image/png",
    });

    global.Response = vi.fn().mockImplementation(() => ({
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(200)),
    })) as any;

    mockEnv.AI.run
      .mockResolvedValueOnce(mockDescriptionResponse)
      .mockResolvedValueOnce(mockPaintingBlob);

    mockStorageService.uploadObject.mockResolvedValue(
      "https://example.com/test.png",
    );
    mockAppDataRepo.createAppDataWithItem.mockRejectedValue(
      new Error("Database error"),
    );

    await expect(
      generateImageFromDrawing({
        env: mockEnv,
        request: { drawing: mockDrawing },
        user: mockUser,
      }),
    ).rejects.toThrow("Database error");
  });

  it("should handle environment without PUBLIC_ASSETS_URL", async () => {
    const mockDrawing = new Blob(["fake-image-data"], { type: "image/png" });
    const mockArrayBuffer = new ArrayBuffer(100);
    vi.spyOn(mockDrawing, "arrayBuffer").mockResolvedValue(mockArrayBuffer);

    const mockDescriptionResponse = { description: "Test description" };
    const mockPaintingBlob = new Blob(["fake-painting-data"], {
      type: "image/png",
    });

    global.Response = vi.fn().mockImplementation(() => ({
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(200)),
    })) as any;

    mockEnv.AI.run
      .mockResolvedValueOnce(mockDescriptionResponse)
      .mockResolvedValueOnce(mockPaintingBlob);

    mockStorageService.uploadObject.mockResolvedValue(
      "https://example.com/test.png",
    );
    mockAppDataRepo.createAppDataWithItem.mockResolvedValue({
      id: "app-data-123",
    });

    const envWithoutAssets = { ...mockEnv, PUBLIC_ASSETS_URL: undefined };

    const result = await generateImageFromDrawing({
      env: envWithoutAssets,
      request: { drawing: mockDrawing },
      user: mockUser,
    });

    expect(result.data.drawingUrl).toBe("/drawings/test-drawing-id/image.png");
    expect(result.data.paintingUrl).toBe(
      "/drawings/test-drawing-id/painting.png",
    );
  });
});
