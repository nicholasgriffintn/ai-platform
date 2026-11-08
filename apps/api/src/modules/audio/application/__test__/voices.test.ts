import { describe, expect, it } from "vitest";

import { resolveMistralSpeechVoice } from "~/modules/audio/application/voices";

const savedVoices = [
  { id: "own-voice", provider: "mistral" as const, name: "Me", created_at: "2026-10-22" },
];

describe("resolveMistralSpeechVoice", () => {
  it("refuses a requested voice the user does not own", () => {
    expect(() =>
      resolveMistralSpeechVoice({
        requestedVoice: "someone-elses-voice",
        defaultVoice: "voice_1787",
        savedVoices,
      }),
    ).toThrow("Use a preset voice or one you saved");
  });
});
