export interface TimedWord {
  word: string;
  start: number;
  end: number;
  speaker?: string;
}

export interface TimedSegment {
  start: number;
  end: number;
  text: string;
  speaker?: string;
}

export interface CaptionCueOptions {
  maxWords?: number;
  maxSeconds?: number;
  minWordsBeforeSentenceBreak?: number;
}

const DEFAULT_MAX_WORDS = 10;
const DEFAULT_MAX_SECONDS = 4;
const DEFAULT_MIN_WORDS_BEFORE_SENTENCE_BREAK = 4;
const SENTENCE_END = /[.!?;]["')\]]?$/;

function joinWords(words: readonly TimedWord[]): string {
  return words
    .map((word) => word.word.trim())
    .filter(Boolean)
    .join(" ");
}

export function buildCaptionCues(
  words: readonly TimedWord[],
  options: CaptionCueOptions = {},
): TimedSegment[] {
  const maxWords = options.maxWords ?? DEFAULT_MAX_WORDS;
  const maxSeconds = options.maxSeconds ?? DEFAULT_MAX_SECONDS;
  const minWords = options.minWordsBeforeSentenceBreak ?? DEFAULT_MIN_WORDS_BEFORE_SENTENCE_BREAK;
  const cues: TimedSegment[] = [];
  let current: TimedWord[] = [];

  const flush = () => {
    const text = joinWords(current);

    if (text) {
      const first = current[0];
      const last = current[current.length - 1];

      cues.push({
        start: first.start,
        end: Math.max(last.end, first.start),
        text,
        ...(first.speaker === undefined ? {} : { speaker: first.speaker }),
      });
    }

    current = [];
  };

  for (const word of words) {
    if (!word.word.trim()) {
      continue;
    }

    if (current.length > 0) {
      const speakerChanged = word.speaker !== current[0].speaker;
      const full = current.length >= maxWords;
      const tooLong = word.end - current[0].start > maxSeconds;

      if (speakerChanged || full || tooLong) {
        flush();
      }
    }

    current.push(word);

    if (current.length >= minWords && SENTENCE_END.test(word.word.trim())) {
      flush();
    }
  }

  flush();

  return cues;
}

export function splitSegmentsIntoCues(
  segments: readonly TimedSegment[],
  options: CaptionCueOptions = {},
): TimedSegment[] {
  const maxWords = options.maxWords ?? DEFAULT_MAX_WORDS;
  const maxSeconds = options.maxSeconds ?? DEFAULT_MAX_SECONDS;

  return segments.flatMap((segment) => {
    const words = segment.text.split(/\s+/).filter(Boolean);
    const duration = Math.max(segment.end - segment.start, 0);

    if (words.length === 0) {
      return [];
    }

    const parts = Math.max(Math.ceil(words.length / maxWords), Math.ceil(duration / maxSeconds), 1);
    const wordsPerPart = Math.ceil(words.length / parts);
    const cues: TimedSegment[] = [];

    for (let index = 0; index < words.length; index += wordsPerPart) {
      const slice = words.slice(index, index + wordsPerPart);
      const end = index + slice.length;

      cues.push({
        start: segment.start + (duration * index) / words.length,
        end: segment.start + (duration * end) / words.length,
        text: slice.join(" "),
        ...(segment.speaker === undefined ? {} : { speaker: segment.speaker }),
      });
    }

    return cues;
  });
}

function splitClock(seconds: number) {
  const totalMilliseconds = Math.max(Math.round(seconds * 1000), 0);
  const hours = Math.floor(totalMilliseconds / 3_600_000);
  const minutes = Math.floor((totalMilliseconds % 3_600_000) / 60_000);
  const secs = Math.floor((totalMilliseconds % 60_000) / 1000);
  const milliseconds = totalMilliseconds % 1000;

  return { hours, minutes, secs, milliseconds };
}

function pad(value: number, length = 2): string {
  return value.toString().padStart(length, "0");
}

export function formatCaptionClock(seconds: number, fractionSeparator: "," | "."): string {
  const { hours, minutes, secs, milliseconds } = splitClock(seconds);

  return `${pad(hours)}:${pad(minutes)}:${pad(secs)}${fractionSeparator}${pad(milliseconds, 3)}`;
}

export function formatTranscriptTimestamp(seconds: number): string {
  const { hours, minutes, secs } = splitClock(seconds);

  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${minutes}:${pad(secs)}`;
}

function cueText(cue: TimedSegment, speakerNames: Readonly<Record<string, string>>): string {
  if (cue.speaker === undefined) {
    return cue.text;
  }

  return `${speakerNames[cue.speaker] ?? cue.speaker}: ${cue.text}`;
}

export function formatSrt(
  cues: readonly TimedSegment[],
  speakerNames: Readonly<Record<string, string>> = {},
): string {
  return cues
    .map(
      (cue, index) =>
        `${index + 1}\n${formatCaptionClock(cue.start, ",")} --> ${formatCaptionClock(cue.end, ",")}\n${cueText(cue, speakerNames)}\n`,
    )
    .join("\n");
}

export function formatVtt(
  cues: readonly TimedSegment[],
  speakerNames: Readonly<Record<string, string>> = {},
): string {
  const body = cues
    .map(
      (cue) =>
        `${formatCaptionClock(cue.start, ".")} --> ${formatCaptionClock(cue.end, ".")}\n${cueText(cue, speakerNames)}\n`,
    )
    .join("\n");

  return body ? `WEBVTT\n\n${body}` : "WEBVTT\n";
}

export function formatTimedTranscript(
  segments: readonly TimedSegment[],
  speakerNames: Readonly<Record<string, string>> = {},
): string {
  return segments
    .map(
      (segment) =>
        `[${formatTranscriptTimestamp(segment.start)}] ${cueText(segment, speakerNames)}`,
    )
    .join("\n");
}
