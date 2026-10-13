import { describe, expect, it } from "vitest";

import { readTranscriptionTimings } from "../capabilities/transcription/timings.js";

describe("readTranscriptionTimings", () => {
  it("reads Whisper segments and their nested words", () => {
    const timings = readTranscriptionTimings({
      text: " Hello there. General Kenobi. ",
      segments: [
        {
          start: 0,
          end: 1.2,
          text: " Hello there.",
          avg_logprob: -0.2,
          words: [
            { word: " Hello", start: 0, end: 0.5 },
            { word: " there.", start: 0.5, end: 1.2 },
          ],
        },
      ],
      vtt: "WEBVTT",
    });

    expect(timings).toEqual({
      text: "Hello there. General Kenobi.",
      segments: [{ start: 0, end: 1.2, text: "Hello there." }],
      words: [
        { word: "Hello", start: 0, end: 0.5 },
        { word: "there.", start: 0.5, end: 1.2 },
      ],
    });
  });

  it("reads Deepgram-style channels with punctuated words and numeric speakers", () => {
    const timings = readTranscriptionTimings({
      results: {
        channels: [
          {
            alternatives: [
              {
                transcript: "hi team",
                words: [
                  { word: "hi", punctuated_word: "Hi", start: 0.1, end: 0.3, speaker: 0 },
                  { word: "team", punctuated_word: "team.", start: 0.3, end: 0.6, speaker: 1 },
                ],
              },
            ],
          },
        ],
      },
    });

    expect(timings).toEqual({
      text: "hi team",
      words: [
        { word: "Hi", start: 0.1, end: 0.3, speaker: "0" },
        { word: "team.", start: 0.3, end: 0.6, speaker: "1" },
      ],
    });
  });

  it("reads diarised Replicate output nested under output and joins segment text", () => {
    const timings = readTranscriptionTimings({
      id: "prediction",
      status: "succeeded",
      output: {
        segments: [
          { start: 0, end: 2, text: "Morning.", speaker: "SPEAKER_00" },
          { start: 2, end: 4, text: "Hi.", speaker: "SPEAKER_01" },
        ],
        num_speakers: 2,
      },
    });

    expect(timings.text).toBe("Morning. Hi.");
    expect(timings.segments).toEqual([
      { start: 0, end: 2, text: "Morning.", speaker: "SPEAKER_00" },
      { start: 2, end: 4, text: "Hi.", speaker: "SPEAKER_01" },
    ]);
  });

  it("returns no timings for a plain text payload", () => {
    expect(readTranscriptionTimings({ text: "just text" })).toEqual({ text: "just text" });
    expect(readTranscriptionTimings("nonsense")).toEqual({});
  });
});
