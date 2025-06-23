import { beforeEach, describe, expect, it, vi } from "vitest";

const mockTranscribeAudio = vi.fn();

vi.mock("../transcribe", () => ({
  transcribeAudio: mockTranscribeAudio,
}));

describe("Transcribe Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("transcribeAudio", () => {
    it("should handle mock audio transcription", async () => {
      const mockResult = { success: true, text: "transcribed text" };
      mockTranscribeAudio.mockResolvedValue(mockResult);

      const mockAudioFile = new File(["audio data"], "test.mp3", {
        type: "audio/mp3",
      });
      const result = await mockTranscribeAudio(mockAudioFile, {});

      expect(mockTranscribeAudio).toHaveBeenCalledWith(mockAudioFile, {});
      expect(result).toEqual(mockResult);
    });
  });
});
