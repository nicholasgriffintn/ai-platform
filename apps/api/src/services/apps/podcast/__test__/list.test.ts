import { beforeEach, describe, expect, it, vi } from "vitest";

import { AssistantError } from "~/utils/errors";
import { handlePodcastList } from "../list";

const mockRepositories = {
  appData: {
    getAppDataByUserAndApp: vi.fn(),
  },
};

vi.mock("~/repositories", () => ({
  RepositoryManager: {
    getInstance: vi.fn(() => mockRepositories),
  },
}));

describe("handlePodcastList", () => {
  const mockEnv = {} as any;
  const mockUser = { id: "user-123", email: "test@example.com" } as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return empty array when no podcasts exist", async () => {
    mockRepositories.appData.getAppDataByUserAndApp.mockResolvedValue([]);

    const result = await handlePodcastList({
      env: mockEnv,
      user: mockUser,
    });

    expect(result).toEqual([]);
    expect(
      mockRepositories.appData.getAppDataByUserAndApp,
    ).toHaveBeenCalledWith("user-123", "podcasts");
  });

  it("should return podcasts with processing status", async () => {
    const mockAppData = [
      {
        item_id: "podcast-1",
        item_type: "upload",
        data: JSON.stringify({
          title: "Test Podcast 1",
          createdAt: "2023-01-01T00:00:00Z",
          duration: 300,
        }),
      },
    ];

    mockRepositories.appData.getAppDataByUserAndApp.mockResolvedValue(
      mockAppData,
    );

    const result = await handlePodcastList({
      env: mockEnv,
      user: mockUser,
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: "podcast-1",
      title: "Test Podcast 1",
      createdAt: "2023-01-01T00:00:00Z",
      imageUrl: undefined,
      duration: 300,
      status: "processing",
    });
  });

  it("should return podcasts with transcribing status", async () => {
    const mockAppData = [
      {
        item_id: "podcast-1",
        item_type: "upload",
        data: JSON.stringify({
          title: "Test Podcast 1",
          createdAt: "2023-01-01T00:00:00Z",
        }),
      },
      {
        item_id: "podcast-1",
        item_type: "transcribe",
        data: JSON.stringify({
          status: "complete",
        }),
      },
    ];

    mockRepositories.appData.getAppDataByUserAndApp.mockResolvedValue(
      mockAppData,
    );

    const result = await handlePodcastList({
      env: mockEnv,
      user: mockUser,
    });

    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("transcribing");
  });

  it("should return podcasts with summarizing status", async () => {
    const mockAppData = [
      {
        item_id: "podcast-1",
        item_type: "upload",
        data: JSON.stringify({
          title: "Test Podcast 1",
          createdAt: "2023-01-01T00:00:00Z",
        }),
      },
      {
        item_id: "podcast-1",
        item_type: "transcribe",
        data: JSON.stringify({ status: "complete" }),
      },
      {
        item_id: "podcast-1",
        item_type: "summary",
        data: JSON.stringify({ summary: "Test summary" }),
      },
    ];

    mockRepositories.appData.getAppDataByUserAndApp.mockResolvedValue(
      mockAppData,
    );

    const result = await handlePodcastList({
      env: mockEnv,
      user: mockUser,
    });

    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("summarizing");
  });

  it("should return podcasts with complete status", async () => {
    const mockAppData = [
      {
        item_id: "podcast-1",
        item_type: "upload",
        data: JSON.stringify({
          title: "Test Podcast 1",
          createdAt: "2023-01-01T00:00:00Z",
        }),
      },
      {
        item_id: "podcast-1",
        item_type: "transcribe",
        data: JSON.stringify({ status: "complete" }),
      },
      {
        item_id: "podcast-1",
        item_type: "summary",
        data: JSON.stringify({ summary: "Test summary" }),
      },
      {
        item_id: "podcast-1",
        item_type: "image",
        data: JSON.stringify({
          imageUrl: "https://example.com/image.png",
        }),
      },
    ];

    mockRepositories.appData.getAppDataByUserAndApp.mockResolvedValue(
      mockAppData,
    );

    const result = await handlePodcastList({
      env: mockEnv,
      user: mockUser,
    });

    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("complete");
    expect(result[0].imageUrl).toBe("https://example.com/image.png");
  });

  it("should handle multiple podcasts", async () => {
    const mockAppData = [
      {
        item_id: "podcast-1",
        item_type: "upload",
        data: JSON.stringify({
          title: "Test Podcast 1",
          createdAt: "2023-01-01T00:00:00Z",
        }),
      },
      {
        item_id: "podcast-2",
        item_type: "upload",
        data: JSON.stringify({
          title: "Test Podcast 2",
          createdAt: "2023-01-02T00:00:00Z",
        }),
      },
    ];

    mockRepositories.appData.getAppDataByUserAndApp.mockResolvedValue(
      mockAppData,
    );

    const result = await handlePodcastList({
      env: mockEnv,
      user: mockUser,
    });

    expect(result).toHaveLength(2);
    expect(result[0].title).toBe("Test Podcast 1");
    expect(result[1].title).toBe("Test Podcast 2");
  });

  it("should use default title for untitled podcasts", async () => {
    const mockAppData = [
      {
        item_id: "podcast-1",
        item_type: "upload",
        data: JSON.stringify({
          createdAt: "2023-01-01T00:00:00Z",
        }),
      },
    ];

    mockRepositories.appData.getAppDataByUserAndApp.mockResolvedValue(
      mockAppData,
    );

    const result = await handlePodcastList({
      env: mockEnv,
      user: mockUser,
    });

    expect(result[0].title).toBe("Untitled Podcast");
  });

  it("should handle malformed JSON data gracefully", async () => {
    const mockAppData = [
      {
        item_id: "podcast-1",
        item_type: "upload",
        data: "invalid-json",
      },
    ];

    mockRepositories.appData.getAppDataByUserAndApp.mockResolvedValue(
      mockAppData,
    );

    const result = await handlePodcastList({
      env: mockEnv,
      user: mockUser,
    });

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Untitled Podcast");
  });

  it("should throw error for missing user ID", async () => {
    await expect(
      handlePodcastList({
        env: mockEnv,
        user: {} as any,
      }),
    ).rejects.toThrow(AssistantError);
  });

  it("should skip items without item_id", async () => {
    const mockAppData = [
      {
        item_type: "upload",
        data: JSON.stringify({
          title: "Test Podcast 1",
        }),
      },
    ];

    mockRepositories.appData.getAppDataByUserAndApp.mockResolvedValue(
      mockAppData,
    );

    const result = await handlePodcastList({
      env: mockEnv,
      user: mockUser,
    });

    expect(result).toEqual([]);
  });
});
