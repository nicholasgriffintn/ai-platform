import { describe, expect, it } from "vitest";

import {
  buildCaptionCues,
  formatSrt,
  formatTimedTranscript,
  formatVtt,
  splitSegmentsIntoCues,
  type TimedWord,
} from "./captions.js";

function words(text: string, secondsPerWord = 0.3, speaker?: string): TimedWord[] {
  return text.split(" ").map((word, index) => ({
    word,
    start: index * secondsPerWord,
    end: (index + 1) * secondsPerWord,
    ...(speaker ? { speaker } : {}),
  }));
}

describe("buildCaptionCues", () => {
  it("breaks after a sentence once a cue has enough words, and never mid-limit", () => {
    const cues = buildCaptionCues(
      words("We shipped it today. Then the pager went off at three in the morning again and again"),
    );

    expect(cues.map((cue) => cue.text)).toEqual([
      "We shipped it today.",
      "Then the pager went off at three in the morning",
      "again and again",
    ]);
  });

  it("keeps a short sentence with the next one", () => {
    expect(buildCaptionCues(words("Yes. We did that")).map((cue) => cue.text)).toEqual([
      "Yes. We did that",
    ]);
  });

  it("starts a new cue when the duration limit would be exceeded or the speaker changes", () => {
    const slow = buildCaptionCues(words("one two three four five six", 1.5));
    const speakers = buildCaptionCues([
      ...words("hello there", 0.3, "A"),
      ...words("hi back", 0.3, "B").map((word) => ({
        ...word,
        start: word.start + 1,
        end: word.end + 1,
      })),
    ]);

    expect(slow.map((cue) => cue.text)).toEqual(["one two", "three four", "five six"]);
    expect(speakers).toEqual([
      { start: 0, end: 0.6, text: "hello there", speaker: "A" },
      { start: 1, end: 1.6, text: "hi back", speaker: "B" },
    ]);
  });
});

describe("splitSegmentsIntoCues", () => {
  it("splits long segments within their own time bounds", () => {
    const cues = splitSegmentsIntoCues([
      { start: 10, end: 18, text: "a b c d e f g h", speaker: "SPEAKER_00" },
    ]);

    expect(cues).toEqual([
      { start: 10, end: 14, text: "a b c d", speaker: "SPEAKER_00" },
      { start: 14, end: 18, text: "e f g h", speaker: "SPEAKER_00" },
    ]);
  });
});

describe("caption formats", () => {
  const cues = [
    { start: 0, end: 1.25, text: "Hello", speaker: "SPEAKER_00" },
    { start: 3661.5, end: 3663, text: "Later" },
  ];

  it("writes SRT with comma milliseconds and named speakers", () => {
    expect(formatSrt(cues, { SPEAKER_00: "Ada" })).toBe(
      "1\n00:00:00,000 --> 00:00:01,250\nAda: Hello\n\n2\n01:01:01,500 --> 01:01:03,000\nLater\n",
    );
  });

  it("writes WebVTT with a header and dot milliseconds", () => {
    expect(formatVtt(cues)).toBe(
      "WEBVTT\n\n00:00:00.000 --> 00:00:01.250\nSPEAKER_00: Hello\n\n01:01:01.500 --> 01:01:03.000\nLater\n",
    );
    expect(formatVtt([])).toBe("WEBVTT\n");
  });

  it("prefixes transcript lines with readable timestamps", () => {
    expect(formatTimedTranscript(cues)).toBe("[0:00] SPEAKER_00: Hello\n[1:01:01] Later");
  });
});
