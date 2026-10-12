import type { TranscriptEntry } from "./useLiveTranscript.js";

export interface TranscriptStats {
  words: number;
  meanWordProbability: number | null;
  struckWords: number;
  phantoms: number;
  meanVerbatim: number | null;
  meanFluent: number | null;
  meanRoundTripMs: number | null;
}

function mean(values: readonly number[]): number | null {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

export function summariseTranscript(entries: readonly TranscriptEntry[]): TranscriptStats {
  const done = entries.flatMap((entry) => (entry.state === "done" ? [entry] : []));
  const transcribed = done.flatMap((entry) =>
    entry.result.status === "transcribed" ? [entry.result] : [],
  );
  const words = transcribed.flatMap((segment) => segment.words);

  return {
    words: words.filter((word) => !word.removed).length,
    meanWordProbability: mean(
      words.flatMap((word) => (word.probability === null ? [] : [word.probability])),
    ),
    struckWords: words.filter((word) => word.removed).length,
    phantoms: done.filter((entry) => entry.result.status === "no_speech").length,
    meanVerbatim: mean(transcribed.map((segment) => segment.checks.verbatim)),
    meanFluent: mean(transcribed.map((segment) => segment.checks.fluent)),
    meanRoundTripMs: mean(done.map((entry) => entry.roundTripMs)),
  };
}
