import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IEnv, IUser } from "~/types";
import { PollyService } from "../polly";

const mockProvider = {
  getResponse: vi.fn(),
};

const mockStorageService = {
  uploadObject: vi.fn(),
};

vi.mock("~/lib/providers/factory", () => ({
  AIProviderFactory: {
    getProvider: vi.fn(() => mockProvider),
  },
}));

vi.mock("~/utils/logger", () => ({
  getLogger: vi.fn(() => ({
    error: vi.fn(),
  })),
}));

describe("PollyService", () => {
  // @ts-expect-error - mock user
  const mockUser = {
    id: "user-123",
    email: "test@example.com",
  } as IUser;

  // @ts-expect-error - mock env
  const mockEnv = {
    AWS_ACCESS_KEY_ID: "test-key",
    AWS_SECRET_ACCESS_KEY: "test-secret",
  } as IEnv;

  let pollyService: PollyService;

  beforeEach(() => {
    vi.clearAllMocks();
    pollyService = new PollyService(mockEnv, mockUser);
  });

  describe("constructor", () => {
    it("should create instance with env and user", () => {
      expect(pollyService).toBeInstanceOf(PollyService);
    });
  });

  describe("synthesizeSpeech", () => {
    const content = "Hello, world!";
    const slug = "test-audio";

    beforeEach(() => {
      mockProvider.getResponse.mockResolvedValue("audio/test-audio.mp3");
    });

    it("should synthesize speech successfully", async () => {
      const result = await pollyService.synthesizeSpeech(
        content,
        mockStorageService as any,
        slug,
      );

      expect(mockProvider.getResponse).toHaveBeenCalledWith({
        model: "Ruth",
        message: content,
        env: mockEnv,
        messages: [],
        user: mockUser,
        options: {
          slug,
          storageService: mockStorageService,
        },
      });

      expect(result).toBe("audio/test-audio.mp3");
    });

    it("should handle empty content", async () => {
      const result = await pollyService.synthesizeSpeech(
        "",
        mockStorageService as any,
        slug,
      );

      expect(mockProvider.getResponse).toHaveBeenCalledWith({
        model: "Ruth",
        message: "",
        env: mockEnv,
        messages: [],
        user: mockUser,
        options: {
          slug,
          storageService: mockStorageService,
        },
      });

      expect(result).toBe("audio/test-audio.mp3");
    });

    it("should handle provider errors", async () => {
      const providerError = new Error("Provider failed");
      mockProvider.getResponse.mockRejectedValue(providerError);

      await expect(
        pollyService.synthesizeSpeech(content, mockStorageService as any, slug),
      ).rejects.toThrow(providerError);
    });

    it("should pass storage service in options", async () => {
      await pollyService.synthesizeSpeech(
        content,
        mockStorageService as any,
        slug,
      );

      expect(mockProvider.getResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            storageService: mockStorageService,
          }),
        }),
      );
    });

    it("should use Ruth voice model", async () => {
      await pollyService.synthesizeSpeech(
        content,
        mockStorageService as any,
        slug,
      );

      expect(mockProvider.getResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "Ruth",
        }),
      );
    });

    it("should pass slug in options", async () => {
      const customSlug = "custom-audio-file";

      await pollyService.synthesizeSpeech(
        content,
        mockStorageService as any,
        customSlug,
      );

      expect(mockProvider.getResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            slug: customSlug,
          }),
        }),
      );
    });
  });
});
