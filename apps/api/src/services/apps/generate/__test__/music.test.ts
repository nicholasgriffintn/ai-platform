import { beforeEach, describe, expect, it, vi } from "vitest";

import { generateMusic } from "../music";

const mockProvider = {
  getResponse: vi.fn(),
};

const mockModelConfig = {
  matchingModel:
    "671ac645ce5e552cc63a54a2bbff63fcf798043055d2dac5fc9e36a837eedcfb",
  provider: "replicate",
  name: "MusicGen",
  replicateInputSchema: {
    fields: [
      { name: "prompt", type: "string", required: true },
      { name: "input_audio", type: ["file", "string"] },
      { name: "duration", type: "number" },
    ],
  },
};

vi.mock("~/lib/providers/factory", () => ({
  AIProviderFactory: {
    getProvider: vi.fn(() => mockProvider),
  },
}));

vi.mock("~/lib/chat/utils", () => ({
  sanitiseInput: vi.fn(),
}));

vi.mock("~/lib/models", () => ({
  getModelConfigByModel: vi.fn(async () => mockModelConfig),
}));

describe("generateMusic", () => {
  const mockEnv = {} as any;
  const mockUser = { id: "user-123", email: "test@example.com" } as any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const { sanitiseInput } = await import("~/lib/chat/utils");
    vi.mocked(sanitiseInput).mockImplementation((input) => input);
    const { getModelConfigByModel } = await import("~/lib/models");
    vi.mocked(getModelConfigByModel).mockResolvedValue(mockModelConfig as any);
  });

  it("should generate music successfully", async () => {
    const mockMusicData = { audio: "https://example.com/music.mp3" };
    mockProvider.getResponse.mockResolvedValue(mockMusicData);

    const result = await generateMusic({
      completion_id: "completion-123",
      app_url: "https://example.com",
      env: mockEnv,
      args: { prompt: "Upbeat electronic music" },
      user: mockUser,
    });

    expect(result.status).toBe("success");
    expect(result.name).toBe("create_music");
    expect(result.content).toBe("Music generated successfully");
    expect(result.data).toBe(mockMusicData);
    expect(mockProvider.getResponse).toHaveBeenCalledWith({
      completion_id: "completion-123",
      app_url: "https://example.com",
      model: "671ac645ce5e552cc63a54a2bbff63fcf798043055d2dac5fc9e36a837eedcfb",
      messages: [
        {
          role: "user",
          content: [{ type: "text", prompt: "Upbeat electronic music" }],
        },
      ],
      env: mockEnv,
      user: mockUser,
    });
  });

  it("should include optional parameters when provided", async () => {
    const mockMusicData = { audio: "https://example.com/music.mp3" };
    mockProvider.getResponse.mockResolvedValue(mockMusicData);

    await generateMusic({
      completion_id: "completion-123",
      app_url: "https://example.com",
      env: mockEnv,
      args: {
        prompt: "Upbeat electronic music",
        input_audio: "base64audiodata",
        duration: 30,
      },
      user: mockUser,
    });

    expect(mockProvider.getResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                prompt: "Upbeat electronic music",
                input_audio: "base64audiodata",
                duration: 30,
              },
            ],
          },
        ],
      }),
    );
  });

  it("should return error for missing prompt", async () => {
    const result = await generateMusic({
      completion_id: "completion-123",
      app_url: "https://example.com",
      env: mockEnv,
      args: { prompt: "" },
      user: mockUser,
    });

    expect(result.status).toBe("error");
    expect(result.name).toBe("create_music");
    expect(result.content).toBe("Missing prompt");
    expect(result.data).toEqual({});
    expect(mockProvider.getResponse).not.toHaveBeenCalled();
  });

  it("should sanitise input prompt", async () => {
    const mockMusicData = { audio: "https://example.com/music.mp3" };
    mockProvider.getResponse.mockResolvedValue(mockMusicData);

    const { sanitiseInput } = await import("~/lib/chat/utils");
    vi.mocked(sanitiseInput).mockReturnValue("sanitised prompt");

    await generateMusic({
      completion_id: "completion-123",
      app_url: "https://example.com",
      env: mockEnv,
      args: { prompt: "unsafe <script>alert('xss')</script> prompt" },
      user: mockUser,
    });

    expect(vi.mocked(sanitiseInput)).toHaveBeenCalledWith(
      "unsafe <script>alert('xss')</script> prompt",
    );
    expect(mockProvider.getResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [
          {
            role: "user",
            content: [
              {
                prompt: "sanitised prompt",
                type: "text",
              },
            ],
          },
        ],
      }),
    );
  });

  it("should handle provider errors", async () => {
    const error = new Error("Provider failed");
    mockProvider.getResponse.mockRejectedValue(error);

    const result = await generateMusic({
      completion_id: "completion-123",
      app_url: "https://example.com",
      env: mockEnv,
      args: { prompt: "Upbeat electronic music" },
      user: mockUser,
    });

    expect(result.status).toBe("error");
    expect(result.name).toBe("create_music");
    expect(result.content).toBe("Provider failed");
    expect(result.data).toEqual({});
  });

  it("should handle unknown errors", async () => {
    mockProvider.getResponse.mockRejectedValue("Unknown error");

    const result = await generateMusic({
      completion_id: "completion-123",
      app_url: "https://example.com",
      env: mockEnv,
      args: { prompt: "Upbeat electronic music" },
      user: mockUser,
    });

    expect(result.status).toBe("error");
    expect(result.name).toBe("create_music");
    expect(result.content).toBe("Failed to generate music");
    expect(result.data).toEqual({});
  });
});
