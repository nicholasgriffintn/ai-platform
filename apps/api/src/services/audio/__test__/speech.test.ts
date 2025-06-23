import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCreateSpeech = vi.fn();

vi.mock("../speech", () => ({
  createSpeech: mockCreateSpeech,
}));

describe("Speech Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createSpeech", () => {
    it("should handle mock speech creation", async () => {
      const mockResult = { success: true, audioData: "mock-audio-data" };
      mockCreateSpeech.mockResolvedValue(mockResult);

      const result = await mockCreateSpeech("test text", {});

      expect(mockCreateSpeech).toHaveBeenCalledWith("test text", {});
      expect(result).toEqual(mockResult);
    });
  });
});
