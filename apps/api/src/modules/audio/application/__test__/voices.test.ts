import { describe, expect, it } from "vitest";

import { resolveMistralSpeechVoice } from "~/modules/audio/application/voices";

const savedVoices = [
  { id: "own-voice", provider: "mistral" as const, name: "Me", created_at: "2026-10-22" },
];

describe("resolveMistralSpeechVoice", () => {
  it("allows presets and the user's own saved voices", () => {
    expect(
      resolveMistralSpeechVoice({
        requestedVoice: "voice_447",
        defaultVoice: "voice_1787",
        savedVoices,
      }),
    ).toBe("voice_447");
    expect(
      resolveMistralSpeechVoice({
        requestedVoice: "own-voice",
        defaultVoice: "voice_1787",
        savedVoices,
      }),
    ).toBe("own-voice");
  });

  it("refuses a requested voice the user does not own", () => {
    expect(() =>
      resolveMistralSpeechVoice({
        requestedVoice: "someone-elses-voice",
        defaultVoice: "voice_1787",
        savedVoices,
      }),
    ).toThrow("Use a preset voice or one you saved");
  });

  it("falls back to the default when the configured voice is no longer usable", () => {
    expect(
      resolveMistralSpeechVoice({
        configuredVoice: "82c99ee6-f932-423f-a4a3-d403c8914b8d",
        defaultVoice: "voice_1787",
        savedVoices,
      }),
    ).toBe("voice_1787");
  });
});
