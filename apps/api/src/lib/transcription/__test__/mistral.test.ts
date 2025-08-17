import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IEnv, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { MistralTranscriptionProvider } from "../mistral";

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("MistralTranscriptionProvider", () => {
  const provider = new MistralTranscriptionProvider();

  const mockEnv: IEnv = {
    MISTRAL_API_KEY: "test-mistral-key",
    AI_GATEWAY_TOKEN: "test-gateway-token",
    ACCOUNT_ID: "test-account-id",
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
        text: "This is the transcribed text from Mistral",
        duration: 10.5,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await provider.transcribe({
        env: mockEnv,
        audio: mockAudio,
        user: mockUser,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://gateway.ai.cloudflare.com/v1/test-account-id/llm-assistant/mistral/v1/audio/transcriptions",
        {
          method: "POST",
          headers: {
            "cf-aig-authorization": "test-gateway-token",
            Authorization: "Bearer test-mistral-key",
          },
          body: expect.any(FormData),
        },
      );

      expect(result).toEqual({
        text: "This is the transcribed text from Mistral",
        data: mockResponse,
      });
    });

    it("should include correct form data for file upload", async () => {
      const mockAudio = new Blob(["audio data"], { type: "audio/wav" });
      const mockResponse = { text: "transcription" };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      await provider.transcribe({
        env: mockEnv,
        audio: mockAudio,
        user: mockUser,
      });

      const formData = mockFetch.mock.calls[0][1].body as FormData;
      expect(formData.get("file")).toBeInstanceOf(File);
      expect(formData.get("file_url")).toBeNull();
      expect(formData.get("model")).toBe("voxtral-mini-2507");
      expect(formData.get("language")).toBe("en");
    });

    it("should include correct form data for URL transcription", async () => {
      const audioUrl = "https://example.com/audio.mp3";
      const mockResponse = { text: "URL transcription" };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      await provider.transcribe({
        env: mockEnv,
        audio: audioUrl,
        user: mockUser,
      });

      const formData = mockFetch.mock.calls[0][1].body as FormData;
      expect(formData.get("file_url")).toBe(audioUrl);
      expect(formData.get("file")).toBeNull();
      expect(formData.get("model")).toBe("voxtral-mini-2507");
      expect(formData.get("language")).toBe("en");
      expect(formData.get("response_format")).toBeNull();
    });

    it("should include timestamps when requested", async () => {
      const mockAudio = new Blob(["audio data"], { type: "audio/wav" });
      const mockResponse = {
        text: "transcription with timestamps",
        segments: [
          { start: 0.0, end: 2.5, text: "Hello" },
          { start: 2.5, end: 5.0, text: "world" },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      await provider.transcribe({
        env: mockEnv,
        audio: mockAudio,
        user: mockUser,
        timestamps: true,
      });

      const formData = mockFetch.mock.calls[0][1].body as FormData;
      expect(formData.get("timestamp_granularities")).toBe("segment");
      expect(formData.get("model")).toBe("voxtral-mini-2507");
      expect(formData.get("language")).toBe("en");
    });

    it("should throw error when MISTRAL_API_KEY is missing", async () => {
      const envWithoutKey = { ...mockEnv, MISTRAL_API_KEY: undefined };
      const mockAudio = new Blob(["audio data"], { type: "audio/wav" });

      await expect(
        provider.transcribe({
          env: envWithoutKey,
          audio: mockAudio,
          user: mockUser,
        }),
      ).rejects.toMatchObject({
        message: "Missing MISTRAL_API_KEY, AI_GATEWAY_TOKEN, or ACCOUNT_ID",
        type: ErrorType.CONFIGURATION_ERROR,
        name: "AssistantError",
      });
    });

    it("should throw error when audio is missing", async () => {
      await expect(
        provider.transcribe({
          env: mockEnv,
          audio: null as any,
          user: mockUser,
        }),
      ).rejects.toMatchObject({
        message: "Missing audio",
        type: ErrorType.PARAMS_ERROR,
        name: "AssistantError",
      });
    });

    it("should throw error when AI_GATEWAY_TOKEN is missing", async () => {
      const envWithoutToken = { ...mockEnv, AI_GATEWAY_TOKEN: undefined };
      const mockAudio = new Blob(["audio data"], { type: "audio/wav" });

      await expect(
        provider.transcribe({
          env: envWithoutToken,
          audio: mockAudio,
          user: mockUser,
        }),
      ).rejects.toMatchObject({
        message: "Missing MISTRAL_API_KEY, AI_GATEWAY_TOKEN, or ACCOUNT_ID",
        type: ErrorType.CONFIGURATION_ERROR,
        name: "AssistantError",
      });
    });

    it("should throw error when ACCOUNT_ID is missing", async () => {
      const envWithoutAccountId = { ...mockEnv, ACCOUNT_ID: undefined };
      const mockAudio = new Blob(["audio data"], { type: "audio/wav" });

      await expect(
        provider.transcribe({
          env: envWithoutAccountId,
          audio: mockAudio,
          user: mockUser,
        }),
      ).rejects.toMatchObject({
        message: "Missing MISTRAL_API_KEY, AI_GATEWAY_TOKEN, or ACCOUNT_ID",
        type: ErrorType.CONFIGURATION_ERROR,
        name: "AssistantError",
      });
    });

    it("should throw error when user is missing", async () => {
      const mockAudio = new Blob(["audio data"], { type: "audio/wav" });

      await expect(
        provider.transcribe({
          env: mockEnv,
          audio: mockAudio,
          user: null as any,
        }),
      ).rejects.toMatchObject({
        message: "Missing user",
        type: ErrorType.PARAMS_ERROR,
        name: "AssistantError",
      });
    });

    it("should handle API errors", async () => {
      const mockAudio = new Blob(["audio data"], { type: "audio/wav" });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: () => Promise.resolve("Bad Request"),
      });

      await expect(
        provider.transcribe({
          env: mockEnv,
          audio: mockAudio,
          user: mockUser,
        }),
      ).rejects.toMatchObject({
        message: "Mistral transcription failed: 400 Bad Request",
        type: ErrorType.EXTERNAL_API_ERROR,
        name: "AssistantError",
      });
    });

    it("should handle missing text in response", async () => {
      const mockAudio = new Blob(["audio data"], { type: "audio/wav" });
      const mockResponse = { duration: 10.5 }; // No text field

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      await expect(
        provider.transcribe({
          env: mockEnv,
          audio: mockAudio,
          user: mockUser,
        }),
      ).rejects.toMatchObject({
        message: "No transcription text returned from Mistral",
        type: ErrorType.EXTERNAL_API_ERROR,
        name: "AssistantError",
      });
    });

    it("should handle network errors", async () => {
      const mockAudio = new Blob(["audio data"], { type: "audio/wav" });

      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      await expect(
        provider.transcribe({
          env: mockEnv,
          audio: mockAudio,
          user: mockUser,
        }),
      ).rejects.toMatchObject({
        message: "Mistral transcription error: Network error",
        type: ErrorType.EXTERNAL_API_ERROR,
        name: "AssistantError",
      });
    });
  });

  describe("provider properties", () => {
    it("should have correct name", () => {
      expect(provider.name).toBe("mistral");
    });

    it("should have correct provider key name", () => {
      // @ts-ignore
      expect(provider.getProviderKeyName()).toBe("MISTRAL_API_KEY");
    });
  });
});
