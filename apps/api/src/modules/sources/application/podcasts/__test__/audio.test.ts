import { describe, expect, it } from "vitest";

import { joinAudioSegments, splitForSpeech, stripId3Tag } from "../audio";

function infoTagged(audio: number[]): Uint8Array {
  const frame = new Uint8Array(417);

  frame.set([0xff, 0xfb, 0x90, 0xc0]);
  frame.set(
    [..."Info"].map((character) => character.charCodeAt(0)),
    21,
  );

  return new Uint8Array([...frame, ...audio]);
}

function id3Tagged(payload: number[], tagBodyLength: number): Uint8Array {
  return new Uint8Array([
    0x49,
    0x44,
    0x33,
    4,
    0,
    0,
    0,
    0,
    0,
    tagBodyLength,
    ...Array.from({ length: tagBodyLength }, () => 0),
    ...payload,
  ]);
}

describe("stripId3Tag", () => {
  it("removes a leading ID3v2 tag and keeps the audio frames", () => {
    expect([...stripId3Tag(id3Tagged([0xff, 0xfb, 1], 5))]).toEqual([0xff, 0xfb, 1]);
  });

  it("leaves untagged audio alone", () => {
    expect([...stripId3Tag(new Uint8Array([0xff, 0xfb, 2]))]).toEqual([0xff, 0xfb, 2]);
  });
});

describe("joinAudioSegments", () => {
  it("joins voiced segments into one stream without repeated tags", () => {
    const joined = joinAudioSegments([id3Tagged([1, 2], 3), id3Tagged([3], 2)]);

    expect([...joined]).toEqual([1, 2, 3]);
  });

  it("drops each segment's Info frame so players time and seek the whole stream", () => {
    const audio = [0xff, 0xfb, 0x90, 0xc0, 7, 8];
    const joined = joinAudioSegments([infoTagged(audio), infoTagged(audio)]);

    expect([...joined]).toEqual([...audio, ...audio]);
  });
});

describe("splitForSpeech", () => {
  it("keeps sentences whole while fitting each request", () => {
    expect(splitForSpeech("One two. Three four. Five.", 12)).toEqual([
      "One two.",
      "Three four.",
      "Five.",
    ]);
  });

  it("cuts a sentence that is longer than one request", () => {
    const pieces = splitForSpeech("a".repeat(25), 10);

    expect(pieces).toEqual(["a".repeat(10), "a".repeat(10), "a".repeat(5)]);
  });
});
