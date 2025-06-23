import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IEnv, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

const mockStorageService = vi.hoisted(() => ({
  uploadObject: vi.fn(),
}));

const mockPollyService = vi.hoisted(() => ({
  synthesizeSpeech: vi.fn(),
}));

const mockCartesiaService = vi.hoisted(() => ({
  synthesizeSpeech: vi.fn(),
}));

const mockElevenLabsService = vi.hoisted(() => ({
  synthesizeSpeech: vi.fn(),
}));

const mockMelottsService = vi.hoisted(() => ({
  synthesizeSpeech: vi.fn(),
}));

const mockGenerateId = vi.hoisted(() => vi.fn(() => "test-id-123"));

const mockSanitiseInput = vi.hoisted(() => vi.fn((input) => input));

vi.mock("~/lib/storage", () => ({
  StorageService: vi.fn(() => mockStorageService),
}));

vi.mock("~/lib/audio/polly", () => ({
  PollyService: vi.fn(() => mockPollyService),
}));

vi.mock("~/lib/audio/cartesia", () => ({
  CartesiaService: vi.fn(() => mockCartesiaService),
}));

vi.mock("~/lib/audio/elevenlabs", () => ({
  ElevenLabsService: vi.fn(() => mockElevenLabsService),
}));

vi.mock("~/lib/audio/melotts", () => ({
  MelottsService: vi.fn(() => mockMelottsService),
}));

vi.mock("~/utils/id", () => ({
  generateId: mockGenerateId,
}));

vi.mock("~/lib/chat/utils", () => ({
  sanitiseInput: mockSanitiseInput,
}));

import { handleTextToSpeech } from "../speech";

describe("handleTextToSpeech", () => {
  const mockEnv: IEnv = {
    ASSETS_BUCKET: "test-bucket",
    PUBLIC_ASSETS_URL: "https://assets.test.com",
  } as any;

  const mockUser: IUser = {
    id: "user-123",
    email: "test@example.com",
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSanitiseInput.mockImplementation((input) => input);
    mockGenerateId.mockReturnValue("test-id-123");
  });

  describe("parameter validation", () => {
    it("should throw error for missing input", async () => {
      mockSanitiseInput.mockReturnValue("");

      await expect(
        handleTextToSpeech({
          env: mockEnv,
          input: "",
          user: mockUser,
        }),
      ).rejects.toThrow(
        new AssistantError("Missing input", ErrorType.PARAMS_ERROR),
      );
    });

    it("should throw error for input too long", async () => {
      const longInput = "a".repeat(4097);

      await expect(
        handleTextToSpeech({
          env: mockEnv,
          input: longInput,
          user: mockUser,
        }),
      ).rejects.toThrow(
        new AssistantError("Input is too long", ErrorType.PARAMS_ERROR),
      );
    });

    it("should sanitize input", async () => {
      mockPollyService.synthesizeSpeech.mockResolvedValue("audio-key");

      await handleTextToSpeech({
        env: mockEnv,
        input: "test input",
        user: mockUser,
      });

      expect(mockSanitiseInput).toHaveBeenCalledWith("test input");
    });
  });

  describe("provider handling", () => {
    it("should use polly provider by default", async () => {
      mockPollyService.synthesizeSpeech.mockResolvedValue("polly-audio-key");

      const result = await handleTextToSpeech({
        env: mockEnv,
        input: "test input",
        user: mockUser,
      });

      expect(mockPollyService.synthesizeSpeech).toHaveBeenCalledWith(
        "test input",
        expect.any(Object),
        "tts/test-40example-com-test-id-123",
      );
      // @ts-expect-error - mock implementation
      expect(result.data.provider).toBe("polly");
    });

    it("should use cartesia provider when specified", async () => {
      mockCartesiaService.synthesizeSpeech.mockResolvedValue(
        "cartesia-audio-key",
      );

      const result = await handleTextToSpeech({
        env: mockEnv,
        input: "test input",
        user: mockUser,
        provider: "cartesia",
      });

      expect(mockCartesiaService.synthesizeSpeech).toHaveBeenCalledWith(
        "test input",
        expect.any(Object),
        "tts/test-40example-com-test-id-123",
      );
      // @ts-expect-error - mock implementation
      expect(result.data.provider).toBe("cartesia");
    });

    it("should use elevenlabs provider when specified", async () => {
      mockElevenLabsService.synthesizeSpeech.mockResolvedValue(
        "elevenlabs-audio-key",
      );

      const result = await handleTextToSpeech({
        env: mockEnv,
        input: "test input",
        user: mockUser,
        provider: "elevenlabs",
      });

      expect(mockElevenLabsService.synthesizeSpeech).toHaveBeenCalledWith(
        "test input",
        expect.any(Object),
        "tts/test-40example-com-test-id-123",
      );
      // @ts-expect-error - mock implementation
      expect(result.data.provider).toBe("elevenlabs");
    });

    it("should use melotts provider when specified", async () => {
      mockMelottsService.synthesizeSpeech.mockResolvedValue("melotts-response");

      const result = await handleTextToSpeech({
        env: mockEnv,
        input: "test input",
        user: mockUser,
        provider: "melotts",
        lang: "es",
      });

      expect(mockMelottsService.synthesizeSpeech).toHaveBeenCalledWith(
        "test input",
        "es",
      );
      // @ts-expect-error - mock implementation
      expect(result.data.provider).toBe("melotts");
    });

    it("should use default language for melotts when not specified", async () => {
      mockMelottsService.synthesizeSpeech.mockResolvedValue("melotts-response");

      await handleTextToSpeech({
        env: mockEnv,
        input: "test input",
        user: mockUser,
        provider: "melotts",
      });

      expect(mockMelottsService.synthesizeSpeech).toHaveBeenCalledWith(
        "test input",
        "en",
      );
    });
  });

  describe("response handling", () => {
    it("should handle string response from provider", async () => {
      mockPollyService.synthesizeSpeech.mockResolvedValue("audio-key-123");

      const result = await handleTextToSpeech({
        env: mockEnv,
        input: "test input",
        user: mockUser,
      });

      expect(result).toEqual({
        status: "success",
        content: "audio-key-123",
        data: {
          audioKey: "audio-key-123",
          audioUrl: "https://assets.test.com/audio-key-123",
          provider: "polly",
        },
      });
    });

    it("should handle object response from provider", async () => {
      const objectResponse = {
        response: "Audio generated successfully",
        url: "https://example.com/audio.mp3",
      };
      mockCartesiaService.synthesizeSpeech.mockResolvedValue(objectResponse);

      const result = await handleTextToSpeech({
        env: mockEnv,
        input: "test input",
        user: mockUser,
        provider: "cartesia",
      });

      expect(result).toEqual({
        status: "success",
        content:
          "Audio generated successfully\n[Listen to the audio](https://example.com/audio.mp3)",
        data: objectResponse,
      });
    });

    it("should handle missing PUBLIC_ASSETS_URL", async () => {
      const envWithoutUrl = { ...mockEnv, PUBLIC_ASSETS_URL: "" };
      mockPollyService.synthesizeSpeech.mockResolvedValue("audio-key-123");

      const result = await handleTextToSpeech({
        env: envWithoutUrl,
        input: "test input",
        user: mockUser,
      });

      // @ts-expect-error - mock implementation
      expect(result.data.audioUrl).toBe("/audio-key-123");
    });

    it("should throw error when provider returns no response", async () => {
      mockPollyService.synthesizeSpeech.mockResolvedValue(null);

      await expect(
        handleTextToSpeech({
          env: mockEnv,
          input: "test input",
          user: mockUser,
        }),
      ).rejects.toThrow(
        new AssistantError("No response from the text-to-speech service"),
      );
    });
  });

  describe("user email slug generation", () => {
    it("should generate slug with user email", async () => {
      mockPollyService.synthesizeSpeech.mockResolvedValue("audio-key");

      await handleTextToSpeech({
        env: mockEnv,
        input: "test input",
        user: mockUser,
      });

      expect(mockPollyService.synthesizeSpeech).toHaveBeenCalledWith(
        "test input",
        expect.any(Object),
        "tts/test-40example-com-test-id-123",
      );
    });

    it("should handle user without email", async () => {
      const userWithoutEmail = { ...mockUser, email: undefined };
      mockPollyService.synthesizeSpeech.mockResolvedValue("audio-key");

      await handleTextToSpeech({
        env: mockEnv,
        input: "test input",
        user: userWithoutEmail,
      });

      expect(mockPollyService.synthesizeSpeech).toHaveBeenCalledWith(
        "test input",
        expect.any(Object),
        "tts/unknown-test-id-123",
      );
    });

    it("should handle special characters in email", async () => {
      const userWithSpecialEmail = {
        ...mockUser,
        email: "test+user@example-site.com",
      };
      mockPollyService.synthesizeSpeech.mockResolvedValue("audio-key");

      await handleTextToSpeech({
        env: mockEnv,
        input: "test input",
        user: userWithSpecialEmail,
      });

      expect(mockPollyService.synthesizeSpeech).toHaveBeenCalledWith(
        "test input",
        expect.any(Object),
        "tts/test-2Buser-40example-site-com-test-id-123",
      );
    });
  });
});
