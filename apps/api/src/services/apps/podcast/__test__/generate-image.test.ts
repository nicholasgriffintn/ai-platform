import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IFunctionResponse } from "~/types";
import { AssistantError } from "~/utils/errors";
import { handlePodcastGenerateImage } from "../generate-image";

const mockRepositories = {
  appData: {
    getAppDataByUserAppAndItem: vi.fn(),
    createAppDataWithItem: vi.fn(),
  },
};

const mockStorageService = {
  uploadObject: vi.fn(),
};

const mockAI = {
  run: vi.fn(),
};

vi.mock("~/repositories", () => ({
  RepositoryManager: {
    getInstance: vi.fn(() => mockRepositories),
  },
}));

vi.mock("~/lib/storage", () => ({
  StorageService: vi.fn(() => mockStorageService),
}));

vi.mock("~/utils/id", () => ({
  generateId: vi.fn(),
}));

describe("handlePodcastGenerateImage", () => {
  const mockEnv = {
    AI: mockAI,
    ASSETS_BUCKET: "test-bucket",
    PUBLIC_ASSETS_URL: "https://assets.example.com",
  } as any;
  const mockUser = { id: "user-123", email: "test@example.com" } as any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const { generateId } = await import("~/utils/id");
    vi.mocked(generateId).mockReturnValue("image-123");
  });

  it("should return existing image when already generated", async () => {
    const existingImage = {
      data: JSON.stringify({
        imageUrl: "https://example.com/existing-image.png",
        imageKey: "existing-key",
        imageId: "existing-id",
      }),
    };

    mockRepositories.appData.getAppDataByUserAppAndItem.mockResolvedValue([
      existingImage,
    ]);

    const result = (await handlePodcastGenerateImage({
      env: mockEnv,
      request: { podcastId: "podcast-123" },
      user: mockUser,
    })) as IFunctionResponse;

    expect(result.status).toBe("success");
    expect(result.content).toBe(
      "Podcast Featured Image: [existing-id](https://example.com/existing-image.png)",
    );
    expect(result.data).toEqual({
      imageUrl: "https://example.com/existing-image.png",
      imageKey: "existing-key",
    });
    expect(mockAI.run).not.toHaveBeenCalled();
  });

  it("should generate new image from summary", async () => {
    const summaryData = {
      data: JSON.stringify({
        summary: "This is a test podcast summary",
      }),
    };

    const mockImageStream = {
      getReader: vi.fn().mockReturnValue({
        read: vi
          .fn()
          .mockResolvedValueOnce({
            done: false,
            value: new Uint8Array([1, 2, 3]),
          })
          .mockResolvedValueOnce({ done: true }),
      }),
    };

    mockRepositories.appData.getAppDataByUserAppAndItem
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([summaryData]);

    mockAI.run.mockResolvedValue(mockImageStream);

    const result = (await handlePodcastGenerateImage({
      env: mockEnv,
      request: { podcastId: "podcast-123" },
      user: mockUser,
    })) as IFunctionResponse;

    expect(result.status).toBe("success");
    expect(result.content).toBe(
      "Podcast Featured Image Uploaded: [image-123](https://assets.example.com/podcasts/image-123/featured.png)",
    );
    expect(mockAI.run).toHaveBeenCalledWith(
      "@cf/bytedance/stable-diffusion-xl-lightning",
      {
        prompt:
          "I need a featured image for my latest podcast episode, this is the summary: This is a test podcast summary",
      },
      expect.objectContaining({
        gateway: expect.objectContaining({
          metadata: { email: "test@example.com" },
        }),
      }),
    );
    expect(mockStorageService.uploadObject).toHaveBeenCalledWith(
      "podcasts/image-123/featured.png",
      expect.any(ArrayBuffer),
      {
        contentType: "image/png",
        contentLength: expect.any(Number),
      },
    );
  });

  it("should throw error for missing podcast ID", async () => {
    await expect(
      handlePodcastGenerateImage({
        env: mockEnv,
        request: { podcastId: "" },
        user: mockUser,
      }),
    ).rejects.toThrow(expect.any(AssistantError));
  });

  it("should throw error for missing user ID", async () => {
    await expect(
      handlePodcastGenerateImage({
        env: mockEnv,
        request: { podcastId: "podcast-123" },
        user: {} as any,
      }),
    ).rejects.toThrow(expect.any(AssistantError));
  });

  it("should throw error when summary not found", async () => {
    mockRepositories.appData.getAppDataByUserAppAndItem
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await expect(
      handlePodcastGenerateImage({
        env: mockEnv,
        request: { podcastId: "podcast-123" },
        user: mockUser,
      }),
    ).rejects.toThrow(expect.any(AssistantError));
  });

  it("should throw error when AI fails to generate image", async () => {
    const summaryData = {
      data: JSON.stringify({
        summary: "This is a test podcast summary",
      }),
    };

    mockRepositories.appData.getAppDataByUserAppAndItem
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([summaryData]);

    mockAI.run.mockResolvedValue(null);

    await expect(
      handlePodcastGenerateImage({
        env: mockEnv,
        request: { podcastId: "podcast-123" },
        user: mockUser,
      }),
    ).rejects.toThrow(expect.any(AssistantError));
  });
});
