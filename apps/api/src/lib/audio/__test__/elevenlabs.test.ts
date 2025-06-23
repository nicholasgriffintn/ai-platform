import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IEnv, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { ElevenLabsService } from "../elevenlabs";

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

describe("ElevenLabsService", () => {
  // @ts-expect-error - mock user
  const mockUser = {
    id: "user-123",
    email: "test@example.com",
  } as IUser;

  const mockEnv = {
    ELEVENLABS_API_KEY: "test-key",
  } as IEnv;

  let elevenLabsService: ElevenLabsService;

  beforeEach(() => {
    vi.clearAllMocks();
    elevenLabsService = new ElevenLabsService(mockEnv, mockUser);
  });

  describe("constructor", () => {
    it("should create instance with env and user", () => {
      expect(elevenLabsService).toBeInstanceOf(ElevenLabsService);
    });
  });

  describe("synthesizeSpeech", () => {
    const content = "Hello, world!";
    const slug = "test-audio";

    beforeEach(() => {
      const mockArrayBuffer = new ArrayBuffer(1024);
      mockProvider.getResponse.mockResolvedValue({
        arrayBuffer: vi.fn().mockResolvedValue(mockArrayBuffer),
      });
      mockStorageService.uploadObject.mockResolvedValue(undefined);
    });

    it("should synthesize speech with default model", async () => {
      const result = await elevenLabsService.synthesizeSpeech(
        content,
        mockStorageService as any,
        slug,
      );

      expect(mockProvider.getResponse).toHaveBeenCalledWith({
        model: "eleven_multilingual_v2",
        message: content,
        env: mockEnv,
        messages: [],
        user: mockUser,
      });

      expect(mockStorageService.uploadObject).toHaveBeenCalledWith(
        `audio/${slug}.mp3`,
        expect.any(Uint8Array),
      );

      expect(result).toBe(`audio/${slug}.mp3`);
    });

    it("should synthesize speech with custom model", async () => {
      const customModel = "eleven_monolingual_v1";

      const result = await elevenLabsService.synthesizeSpeech(
        content,
        mockStorageService as any,
        slug,
        customModel,
      );

      expect(mockProvider.getResponse).toHaveBeenCalledWith({
        model: customModel,
        message: content,
        env: mockEnv,
        messages: [],
        user: mockUser,
      });

      expect(result).toBe(`audio/${slug}.mp3`);
    });

    it("should throw error when no audio data received", async () => {
      mockProvider.getResponse.mockResolvedValue({
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
      });

      await expect(
        elevenLabsService.synthesizeSpeech(
          content,
          mockStorageService as any,
          slug,
        ),
      ).rejects.toThrow(
        new AssistantError(
          "No audio data in ElevenLabs response",
          ErrorType.PROVIDER_ERROR,
        ),
      );
    });

    it("should throw error when audio data is null", async () => {
      mockProvider.getResponse.mockResolvedValue({
        arrayBuffer: vi.fn().mockResolvedValue(null),
      });

      await expect(
        elevenLabsService.synthesizeSpeech(
          content,
          mockStorageService as any,
          slug,
        ),
      ).rejects.toThrow(
        new AssistantError(
          "No audio data in ElevenLabs response",
          ErrorType.PROVIDER_ERROR,
        ),
      );
    });

    it("should handle provider errors", async () => {
      const providerError = new Error("Provider failed");
      mockProvider.getResponse.mockRejectedValue(providerError);

      await expect(
        elevenLabsService.synthesizeSpeech(
          content,
          mockStorageService as any,
          slug,
        ),
      ).rejects.toThrow(providerError);
    });

    it("should handle storage upload errors", async () => {
      const storageError = new Error("Upload failed");
      mockStorageService.uploadObject.mockRejectedValue(storageError);

      await expect(
        elevenLabsService.synthesizeSpeech(
          content,
          mockStorageService as any,
          slug,
        ),
      ).rejects.toThrow(storageError);
    });

    it("should handle arrayBuffer conversion errors", async () => {
      const arrayBufferError = new Error("ArrayBuffer conversion failed");
      mockProvider.getResponse.mockResolvedValue({
        arrayBuffer: vi.fn().mockRejectedValue(arrayBufferError),
      });

      await expect(
        elevenLabsService.synthesizeSpeech(
          content,
          mockStorageService as any,
          slug,
        ),
      ).rejects.toThrow(arrayBufferError);
    });

    it("should handle empty content", async () => {
      const result = await elevenLabsService.synthesizeSpeech(
        "",
        mockStorageService as any,
        slug,
      );

      expect(mockProvider.getResponse).toHaveBeenCalledWith({
        model: "eleven_multilingual_v2",
        message: "",
        env: mockEnv,
        messages: [],
        user: mockUser,
      });

      expect(result).toBe(`audio/${slug}.mp3`);
    });
  });
});
