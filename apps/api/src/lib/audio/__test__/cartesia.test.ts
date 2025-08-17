import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IEnv, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { CartesiaService } from "../cartesia";

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

describe("CartesiaService", () => {
  // @ts-expect-error - mock user
  const mockUser = {
    id: "user-123",
    email: "test@example.com",
  } as IUser;

  const mockEnv = {
    CARTESIA_API_KEY: "test-key",
  } as IEnv;

  let cartesiaService: CartesiaService;

  beforeEach(() => {
    vi.clearAllMocks();
    cartesiaService = new CartesiaService(mockEnv, mockUser);
  });

  describe("constructor", () => {
    it("should create instance with env and user", () => {
      expect(cartesiaService).toBeInstanceOf(CartesiaService);
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

    it("should synthesize speech successfully", async () => {
      const result = await cartesiaService.synthesizeSpeech(
        content,
        mockStorageService as any,
        slug,
      );

      expect(mockProvider.getResponse).toHaveBeenCalledWith({
        model: "sonic",
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

    it("should throw error when no audio data received", async () => {
      mockProvider.getResponse.mockResolvedValue({
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
      });

      await expect(
        cartesiaService.synthesizeSpeech(
          content,
          mockStorageService as any,
          slug,
        ),
      ).rejects.toMatchObject({
        message: "No audio data in ElevenLabs response",
        type: ErrorType.PROVIDER_ERROR,
        name: "AssistantError",
      });
    });

    it("should throw error when audio data is null", async () => {
      mockProvider.getResponse.mockResolvedValue({
        arrayBuffer: vi.fn().mockResolvedValue(null),
      });

      await expect(
        cartesiaService.synthesizeSpeech(
          content,
          mockStorageService as any,
          slug,
        ),
      ).rejects.toMatchObject({
        message: "No audio data in ElevenLabs response",
        type: ErrorType.PROVIDER_ERROR,
        name: "AssistantError",
      });
    });

    it("should handle provider errors", async () => {
      const providerError = new Error("Provider failed");
      mockProvider.getResponse.mockRejectedValue(providerError);

      await expect(
        cartesiaService.synthesizeSpeech(
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
        cartesiaService.synthesizeSpeech(
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
        cartesiaService.synthesizeSpeech(
          content,
          mockStorageService as any,
          slug,
        ),
      ).rejects.toThrow(arrayBufferError);
    });
  });
});
