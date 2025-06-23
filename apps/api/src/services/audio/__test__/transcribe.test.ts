import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IEnv, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

const mockAI = vi.hoisted(() => ({
  run: vi.fn(),
}));

const mockGatewayId = vi.hoisted(() => "test-gateway-id");

vi.mock("~/constants/app", () => ({
  gatewayId: mockGatewayId,
}));

import { handleTranscribe } from "../transcribe";

describe("handleTranscribe", () => {
  const mockEnv: IEnv = {
    AI: mockAI,
  } as any;

  const mockUser: IUser = {
    id: "user-123",
    email: "test@example.com",
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("parameter validation", () => {
    it("should throw error when AI binding is missing", async () => {
      const envWithoutAI = { ...mockEnv, AI: undefined };
      const mockAudio = new Blob(["audio data"], { type: "audio/mp3" });

      await expect(
        handleTranscribe({
          env: envWithoutAI,
          audio: mockAudio,
          user: mockUser,
        }),
      ).rejects.toThrow(
        new AssistantError("Missing AI binding", ErrorType.PARAMS_ERROR),
      );
    });

    it("should throw error when audio is missing", async () => {
      await expect(
        handleTranscribe({
          env: mockEnv,
          audio: null as any,
          user: mockUser,
        }),
      ).rejects.toThrow(
        new AssistantError("Missing audio", ErrorType.PARAMS_ERROR),
      );
    });
  });

  describe("successful transcription", () => {
    it("should transcribe audio successfully", async () => {
      const mockAudio = new Blob(["audio data"], { type: "audio/mp3" });
      const mockResponse = {
        text: "This is the transcribed text",
        other_data: "additional metadata",
      };

      mockAI.run.mockResolvedValue(mockResponse);

      const result = await handleTranscribe({
        env: mockEnv,
        audio: mockAudio,
        user: mockUser,
      });

      expect(mockAI.run).toHaveBeenCalledWith(
        "@cf/openai/whisper",
        {
          audio: expect.any(Array),
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

      expect(result).toEqual({
        status: "success",
        content: "This is the transcribed text",
        data: mockResponse,
      });
    });

    it("should handle user without email", async () => {
      const userWithoutEmail = { ...mockUser, email: undefined };
      const mockAudio = new Blob(["audio data"], { type: "audio/mp3" });
      const mockResponse = { text: "transcribed text" };

      mockAI.run.mockResolvedValue(mockResponse);

      await handleTranscribe({
        env: mockEnv,
        audio: mockAudio,
        user: userWithoutEmail,
      });

      expect(mockAI.run).toHaveBeenCalledWith(
        "@cf/openai/whisper",
        expect.any(Object),
        {
          gateway: {
            id: "test-gateway-id",
            skipCache: false,
            cacheTtl: 3360,
            metadata: {
              email: undefined,
            },
          },
        },
      );
    });

    it("should convert audio blob to correct format", async () => {
      const audioData = new Uint8Array([1, 2, 3, 4, 5]);
      const mockAudio = new Blob([audioData], { type: "audio/wav" });
      const mockResponse = { text: "test transcription" };

      mockAI.run.mockResolvedValue(mockResponse);

      await handleTranscribe({
        env: mockEnv,
        audio: mockAudio,
        user: mockUser,
      });

      expect(mockAI.run).toHaveBeenCalledWith(
        "@cf/openai/whisper",
        {
          audio: [1, 2, 3, 4, 5],
        },
        expect.any(Object),
      );
    });
  });

  describe("error handling", () => {
    it("should throw error when model returns no text", async () => {
      const mockAudio = new Blob(["audio data"], { type: "audio/mp3" });
      const mockResponse = {
        other_data: "metadata",
      };

      mockAI.run.mockResolvedValue(mockResponse);

      await expect(
        handleTranscribe({
          env: mockEnv,
          audio: mockAudio,
          user: mockUser,
        }),
      ).rejects.toThrow(new AssistantError("No response from the model"));
    });

    it("should throw error when model returns empty text", async () => {
      const mockAudio = new Blob(["audio data"], { type: "audio/mp3" });
      const mockResponse = {
        text: "",
      };

      mockAI.run.mockResolvedValue(mockResponse);

      await expect(
        handleTranscribe({
          env: mockEnv,
          audio: mockAudio,
          user: mockUser,
        }),
      ).rejects.toThrow(new AssistantError("No response from the model"));
    });

    it("should handle AI.run errors", async () => {
      const mockAudio = new Blob(["audio data"], { type: "audio/mp3" });

      mockAI.run.mockRejectedValue(new Error("AI service error"));

      await expect(
        handleTranscribe({
          env: mockEnv,
          audio: mockAudio,
          user: mockUser,
        }),
      ).rejects.toThrow("AI service error");
    });
  });

  describe("gateway configuration", () => {
    it("should use correct gateway configuration", async () => {
      const mockAudio = new Blob(["audio data"], { type: "audio/mp3" });
      const mockResponse = { text: "test transcription" };

      mockAI.run.mockResolvedValue(mockResponse);

      await handleTranscribe({
        env: mockEnv,
        audio: mockAudio,
        user: mockUser,
      });

      const gatewayConfig = mockAI.run.mock.calls[0][2];
      expect(gatewayConfig.gateway.id).toBe("test-gateway-id");
      expect(gatewayConfig.gateway.skipCache).toBe(false);
      expect(gatewayConfig.gateway.cacheTtl).toBe(3360);
      expect(gatewayConfig.gateway.metadata.email).toBe("test@example.com");
    });
  });

  describe("audio formats", () => {
    it("should handle different audio blob types", async () => {
      const formats = ["audio/mp3", "audio/wav", "audio/m4a", "audio/ogg"];
      const mockResponse = { text: "transcription" };

      mockAI.run.mockResolvedValue(mockResponse);

      for (const format of formats) {
        const mockAudio = new Blob(["audio data"], { type: format });

        const result = await handleTranscribe({
          env: mockEnv,
          audio: mockAudio,
          user: mockUser,
        });

        // @ts-expect-error - mock implementation
        expect(result.status).toBe("success");
        // @ts-expect-error - mock implementation
        expect(result.content).toBe("transcription");
      }
    });

    it("should handle large audio files", async () => {
      const largeAudioData = new Uint8Array(1024 * 1024);
      for (let i = 0; i < largeAudioData.length; i++) {
        largeAudioData[i] = i % 256;
      }
      const mockAudio = new Blob([largeAudioData], { type: "audio/wav" });
      const mockResponse = { text: "large file transcription" };

      mockAI.run.mockResolvedValue(mockResponse);

      const result = await handleTranscribe({
        env: mockEnv,
        audio: mockAudio,
        user: mockUser,
      });

      // @ts-expect-error - mock implementation
      expect(result.status).toBe("success");
      // @ts-expect-error - mock implementation
      expect(result.content).toBe("large file transcription");
      expect(mockAI.run).toHaveBeenCalledWith(
        "@cf/openai/whisper",
        {
          audio: Array.from(largeAudioData),
        },
        expect.any(Object),
      );
    });
  });
});
