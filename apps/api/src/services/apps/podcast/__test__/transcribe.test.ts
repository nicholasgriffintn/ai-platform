import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IFunctionResponse } from "~/types";
import { AssistantError } from "~/utils/errors";
import { handlePodcastTranscribe } from "../transcribe";

const mockRepositories = {
  appData: {
    getAppDataByUserAppAndItem: vi.fn(),
    createAppDataWithItem: vi.fn(),
  },
};

const mockProvider = {
  getResponse: vi.fn(),
};

vi.mock("~/repositories", () => ({
  RepositoryManager: {
    getInstance: vi.fn(() => mockRepositories),
  },
}));

vi.mock("~/lib/providers/factory", () => ({
  AIProviderFactory: {
    getProvider: vi.fn(() => mockProvider),
  },
}));

vi.mock("~/lib/models", () => ({
  getModelConfigByMatchingModel: vi.fn(),
}));

describe("handlePodcastTranscribe", () => {
  const mockEnv = { DB: {} } as any;
  const mockUser = { id: "user-123", email: "test@example.com" } as any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const { getModelConfigByMatchingModel } = await import("~/lib/models");
    vi.mocked(getModelConfigByMatchingModel).mockResolvedValue({
      provider: "replicate",
      matchingModel:
        "cbd15da9f839c5f932742f86ce7def3a03c22e2b4171d42823e83e314547003f",
      type: ["speech"],
    });
  });

  it("should return existing transcription when already processed", async () => {
    const existingTranscription = {
      data: JSON.stringify({
        transcriptionData: { output: "existing transcription" },
      }),
    };

    mockRepositories.appData.getAppDataByUserAppAndItem.mockResolvedValue([
      existingTranscription,
    ]);

    const result = (await handlePodcastTranscribe({
      env: mockEnv,
      request: {
        podcastId: "podcast-123",
        numberOfSpeakers: 2,
        prompt: "Transcribe this podcast",
      },
      user: mockUser,
    })) as IFunctionResponse;

    expect(result.status).toBe("success");
    expect(result.content).toBe("Podcast Transcription retrieved from cache");
    expect(result.data).toEqual({ output: "existing transcription" });
    expect(mockProvider.getResponse).not.toHaveBeenCalled();
  });

  it("should transcribe podcast successfully", async () => {
    const uploadData = {
      data: JSON.stringify({
        title: "Test Podcast",
        description: "Test Description",
        audioUrl: "https://example.com/audio.mp3",
      }),
    };

    const mockTranscriptionData = {
      id: "transcription-123",
      status: "in_progress",
      data: {
        asyncInvocation: {
          provider: "replicate",
          id: "transcription-123",
        },
      },
    };

    mockRepositories.appData.getAppDataByUserAppAndItem
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([uploadData]);

    mockProvider.getResponse.mockResolvedValue(mockTranscriptionData);

    const result = (await handlePodcastTranscribe({
      env: mockEnv,
      request: {
        podcastId: "podcast-123",
        numberOfSpeakers: 2,
        prompt: "Transcribe this podcast",
      },
      user: mockUser,
      app_url: "https://example.com",
    })) as IFunctionResponse;

    expect(result.status).toBe("success");
    expect(result.content).toBe(
      "Podcast transcription started: transcription-123",
    );
    expect(mockProvider.getResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        completion_id: "podcast-123",
        should_poll: true,
      }),
    );
  });

  it("should throw error for missing required parameters", async () => {
    await expect(
      handlePodcastTranscribe({
        env: mockEnv,
        request: {
          podcastId: "",
          numberOfSpeakers: 2,
          prompt: "Transcribe this podcast",
        },
        user: mockUser,
      }),
    ).rejects.toThrow(expect.any(AssistantError));
  });

  it("should throw error for missing user ID", async () => {
    await expect(
      handlePodcastTranscribe({
        env: mockEnv,
        request: {
          podcastId: "podcast-123",
          numberOfSpeakers: 2,
          prompt: "Transcribe this podcast",
        },
        user: {} as any,
      }),
    ).rejects.toThrow(expect.any(AssistantError));
  });

  it("should throw error when upload not found", async () => {
    mockRepositories.appData.getAppDataByUserAppAndItem
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await expect(
      handlePodcastTranscribe({
        env: mockEnv,
        request: {
          podcastId: "podcast-123",
          numberOfSpeakers: 2,
          prompt: "Transcribe this podcast",
        },
        user: mockUser,
      }),
    ).rejects.toThrow(expect.any(AssistantError));
  });
});
