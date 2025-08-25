import { describe, expect, it } from "vitest";

function selectTranscriptionProvider(contentLengthBytes: number): string {
  const TWENTY_FIVE_MB = 25 * 1024 * 1024;
  const FIFTY_MB = 50 * 1024 * 1024;

  if (contentLengthBytes <= TWENTY_FIVE_MB) {
    return "workers";
  } else if (contentLengthBytes <= FIFTY_MB) {
    return "mistral";
  } else {
    return "replicate";
  }
}

describe("Transcription Provider Selection Logic", () => {
  it("should select Workers AI for small files (≤25MB)", () => {
    const provider = selectTranscriptionProvider(10 * 1024 * 1024); // 10MB
    expect(provider).toBe("workers");
  });

  it("should select Workers AI for exactly 25MB files", () => {
    const provider = selectTranscriptionProvider(25 * 1024 * 1024); // 25MB
    expect(provider).toBe("workers");
  });

  it("should select Mistral for medium files (25MB < size ≤ 50MB)", () => {
    const provider = selectTranscriptionProvider(30 * 1024 * 1024); // 30MB
    expect(provider).toBe("mistral");
  });

  it("should select Mistral for exactly 50MB files", () => {
    const provider = selectTranscriptionProvider(50 * 1024 * 1024); // 50MB
    expect(provider).toBe("mistral");
  });

  it("should select Replicate for large files (>50MB)", () => {
    const provider = selectTranscriptionProvider(100 * 1024 * 1024); // 100MB
    expect(provider).toBe("replicate");
  });

  it("should select Replicate for very large files", () => {
    const provider = selectTranscriptionProvider(500 * 1024 * 1024); // 500MB
    expect(provider).toBe("replicate");
  });
});
