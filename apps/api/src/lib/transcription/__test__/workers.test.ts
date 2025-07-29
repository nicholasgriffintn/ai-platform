import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IEnv, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { WorkersTranscriptionProvider } from "../workers";

const mockAI = vi.hoisted(() => ({
  run: vi.fn(),
}));

const mockGatewayId = vi.hoisted(() => "test-gateway-id");

vi.mock("~/constants/app", () => ({
  gatewayId: mockGatewayId,
}));

describe("WorkersTranscriptionProvider", () => {
  const provider = new WorkersTranscriptionProvider();

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

  describe("transcribe", () => {
    it("should transcribe audio successfully", async () => {
      const mockAudio = new Blob(["audio data"], { type: "audio/wav" });
      const mockResponse = {
        text: "This is the transcribed text from Workers AI",
        other_data: "additional metadata",
      };

      mockAI.run.mockResolvedValue(mockResponse);

      const result = await provider.transcribe({
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
        text: "This is the transcribed text from Workers AI",
        data: mockResponse,
      });
    });

    it("should handle user without email", async () => {
      const userWithoutEmail = { ...mockUser, email: undefined };
      const mockAudio = new Blob(["audio data"], { type: "audio/wav" });
      const mockResponse = { text: "transcribed text" };

      mockAI.run.mockResolvedValue(mockResponse);

      await provider.transcribe({
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

      await provider.transcribe({
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

    it("should throw error when AI binding is missing", async () => {
      const envWithoutAI = { ...mockEnv, AI: undefined };
      const mockAudio = new Blob(["audio data"], { type: "audio/wav" });

      await expect(
        provider.transcribe({
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
        provider.transcribe({
          env: mockEnv,
          audio: null as any,
          user: mockUser,
        }),
      ).rejects.toThrow(
        new AssistantError("Missing audio", ErrorType.PARAMS_ERROR),
      );
    });

    it("should throw error when user is missing", async () => {
      const mockAudio = new Blob(["audio data"], { type: "audio/wav" });

      await expect(
        provider.transcribe({
          env: mockEnv,
          audio: mockAudio,
          user: null as any,
        }),
      ).rejects.toThrow(
        new AssistantError("Missing user", ErrorType.PARAMS_ERROR),
      );
    });

    it("should throw error when model returns no text", async () => {
      const mockAudio = new Blob(["audio data"], { type: "audio/wav" });
      const mockResponse = { other_data: "metadata" };

      mockAI.run.mockResolvedValue(mockResponse);

      await expect(
        provider.transcribe({
          env: mockEnv,
          audio: mockAudio,
          user: mockUser,
        }),
      ).rejects.toThrow(new AssistantError("No response from the model"));
    });

    it("should throw error when model returns empty text", async () => {
      const mockAudio = new Blob(["audio data"], { type: "audio/wav" });
      const mockResponse = { text: "" };

      mockAI.run.mockResolvedValue(mockResponse);

      await expect(
        provider.transcribe({
          env: mockEnv,
          audio: mockAudio,
          user: mockUser,
        }),
      ).rejects.toThrow(new AssistantError("No response from the model"));
    });

    it("should handle AI.run errors", async () => {
      const mockAudio = new Blob(["audio data"], { type: "audio/wav" });

      mockAI.run.mockRejectedValue(new Error("AI service error"));

      await expect(
        provider.transcribe({
          env: mockEnv,
          audio: mockAudio,
          user: mockUser,
        }),
      ).rejects.toThrow(
        new AssistantError(
          "Workers AI transcription error: AI service error",
          ErrorType.EXTERNAL_API_ERROR,
        ),
      );
    });
  });

  describe("provider properties", () => {
    it("should have correct name", () => {
      expect(provider.name).toBe("workers");
    });

    it("should not require API key", () => {
      // @ts-ignore
      expect(provider.getProviderKeyName()).toBeUndefined();
    });
  });
});
