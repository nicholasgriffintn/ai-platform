import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IEnv, IUser } from "~/types";
import { MelottsService } from "../melotts";

const mockProvider = {
  getResponse: vi.fn(),
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

describe("MelottsService", () => {
  // @ts-expect-error - mock user
  const mockUser = {
    id: "user-123",
    email: "test@example.com",
  } as IUser;

  // @ts-expect-error - mock env
  const mockEnv = {
    WORKERS_AI_API_KEY: "test-key",
  } as IEnv;

  let melottsService: MelottsService;

  beforeEach(() => {
    vi.clearAllMocks();
    melottsService = new MelottsService(mockEnv, mockUser);
  });

  describe("constructor", () => {
    it("should create instance with env and user", () => {
      expect(melottsService).toBeInstanceOf(MelottsService);
    });

    it("should initialize workers-ai provider", () => {
      expect(melottsService).toBeInstanceOf(MelottsService);
    });
  });

  describe("synthesizeSpeech", () => {
    const content = "Hello, world!";

    beforeEach(() => {
      mockProvider.getResponse.mockResolvedValue("audio-response");
    });

    it("should synthesize speech with default language", async () => {
      const result = await melottsService.synthesizeSpeech(content);

      expect(mockProvider.getResponse).toHaveBeenCalledWith({
        model: "@cf/myshell-ai/melotts",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: content,
              },
            ],
          },
        ],
        lang: "en",
        env: mockEnv,
        user: mockUser,
      });

      expect(result).toBe("audio-response");
    });

    it("should synthesize speech with custom language", async () => {
      const customLang = "es";

      const result = await melottsService.synthesizeSpeech(content, customLang);

      expect(mockProvider.getResponse).toHaveBeenCalledWith({
        model: "@cf/myshell-ai/melotts",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: content,
              },
            ],
          },
        ],
        lang: customLang,
        env: mockEnv,
        user: mockUser,
      });

      expect(result).toBe("audio-response");
    });

    it("should handle empty content", async () => {
      const result = await melottsService.synthesizeSpeech("");

      expect(mockProvider.getResponse).toHaveBeenCalledWith({
        model: "@cf/myshell-ai/melotts",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "",
              },
            ],
          },
        ],
        lang: "en",
        env: mockEnv,
        user: mockUser,
      });

      expect(result).toBe("audio-response");
    });

    it("should handle provider errors", async () => {
      const providerError = new Error("Provider failed");
      mockProvider.getResponse.mockRejectedValue(providerError);

      await expect(melottsService.synthesizeSpeech(content)).rejects.toThrow(
        providerError,
      );
    });

    it("should use correct model", async () => {
      await melottsService.synthesizeSpeech(content);

      expect(mockProvider.getResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "@cf/myshell-ai/melotts",
        }),
      );
    });

    it("should format message correctly", async () => {
      const testContent = "Test message for TTS";

      await melottsService.synthesizeSpeech(testContent);

      expect(mockProvider.getResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: testContent,
                },
              ],
            },
          ],
        }),
      );
    });

    it("should support different languages", async () => {
      const languages = ["en", "es", "fr", "de", "it"];

      for (const lang of languages) {
        await melottsService.synthesizeSpeech(content, lang);

        expect(mockProvider.getResponse).toHaveBeenCalledWith(
          expect.objectContaining({
            lang,
          }),
        );
      }
    });
  });
});
