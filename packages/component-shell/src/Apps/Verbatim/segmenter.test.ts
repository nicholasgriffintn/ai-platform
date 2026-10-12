import { describe, expect, it } from "vitest";

import { SEGMENT_SAMPLE_RATE, SpeechSegmenter } from "./segmenter";

const CHUNK_MS = 100;

function chunk(amplitude: number): ArrayBuffer {
  return new Int16Array((SEGMENT_SAMPLE_RATE * CHUNK_MS) / 1000).fill(amplitude).buffer;
}

function feed(segmenter: SpeechSegmenter, amplitudes: number[], start = 0) {
  return amplitudes.map((amplitude, index) =>
    segmenter.push(chunk(amplitude), start + index * CHUNK_MS),
  );
}

describe("SpeechSegmenter", () => {
  it("never commits silence and keeps only a short pre-roll", () => {
    const segmenter = new SpeechSegmenter();
    const steps = feed(segmenter, Array<number>(100).fill(0));

    expect(steps.every((step) => step.segment === null)).toBe(true);
    expect(segmenter.flush()).toBeNull();
  });

  it("commits a phrase with its pre-roll once the speaker pauses", () => {
    const segmenter = new SpeechSegmenter();
    const steps = feed(segmenter, [
      ...Array<number>(20).fill(0),
      ...Array<number>(10).fill(6000),
      ...Array<number>(10).fill(0),
    ]);
    const committed = steps.flatMap((step) => (step.segment ? [step.segment] : []));

    expect(committed).toHaveLength(1);
    expect(committed[0]?.length).toBeGreaterThan(10);
    expect(committed[0]?.length).toBeLessThan(30);
  });

  it("exposes the phrase in progress for live drafts without committing it", () => {
    const segmenter = new SpeechSegmenter();

    expect(segmenter.peek()).toBeNull();
    feed(segmenter, Array<number>(10).fill(6000));

    expect(segmenter.peek()?.length).toBeGreaterThan(5);
    expect(segmenter.peek()).not.toBe(segmenter.peek());
  });

  it("splits continuous speech so live transcripts keep moving", () => {
    const segmenter = new SpeechSegmenter();
    const steps = feed(segmenter, Array<number>(300).fill(6000));

    expect(steps.filter((step) => step.segment).length).toBeGreaterThanOrEqual(2);
  });
});
