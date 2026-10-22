import type { TranscriptionSegment, TranscriptionWord } from "@ngriffin_uk/polychat-schemas";
import z from "zod/v4";

const speakerSchema = z
  .union([z.string(), z.number()])
  .optional()
  .transform((value) => (value === undefined ? undefined : String(value)));

const timedWordSchema = z.object({
  word: z.string(),
  punctuated_word: z.string().optional(),
  start: z.number(),
  end: z.number(),
  speaker: speakerSchema,
});

const timedSegmentSchema = z
  .object({
    start: z.number(),
    end: z.number(),
    text: z.string(),
    speaker: speakerSchema,
    speaker_id: speakerSchema,
    words: z.array(timedWordSchema).optional(),
  })
  .transform(({ speaker_id, ...segment }) => ({
    ...segment,
    speaker: segment.speaker ?? speaker_id,
  }));

const segmentedTranscriptSchema = z.object({
  text: z.string().optional(),
  segments: z.array(timedSegmentSchema).optional(),
  words: z.array(timedWordSchema).optional(),
});

const deepgramTranscriptSchema = z.object({
  results: z.object({
    channels: z.array(
      z.object({
        alternatives: z
          .array(
            z.object({
              transcript: z.string().optional(),
              words: z.array(timedWordSchema).optional(),
            }),
          )
          .optional(),
      }),
    ),
  }),
});

export interface TranscriptionTimings {
  text?: string;
  segments?: TranscriptionSegment[];
  words?: TranscriptionWord[];
}

type ParsedWord = z.infer<typeof timedWordSchema>;

function toWord(word: ParsedWord): TranscriptionWord {
  return {
    word: (word.punctuated_word ?? word.word).trim(),
    start: Math.max(word.start, 0),
    end: Math.max(word.end, word.start, 0),
    ...(word.speaker === undefined ? {} : { speaker: word.speaker }),
  };
}

function nonEmpty<T>(values: T[]): T[] | undefined {
  return values.length > 0 ? values : undefined;
}

function readSegmented(payload: unknown): TranscriptionTimings | null {
  const parsed = segmentedTranscriptSchema.safeParse(payload);

  if (!parsed.success) {
    return null;
  }

  const segments = (parsed.data.segments ?? [])
    .map((segment) => ({
      start: Math.max(segment.start, 0),
      end: Math.max(segment.end, segment.start, 0),
      text: segment.text.trim(),
      ...(segment.speaker === undefined ? {} : { speaker: segment.speaker }),
    }))
    .filter((segment) => segment.text);
  const words = [
    ...(parsed.data.words ?? []),
    ...(parsed.data.segments ?? []).flatMap((segment) =>
      (segment.words ?? []).map((word) => ({ ...word, speaker: word.speaker ?? segment.speaker })),
    ),
  ]
    .map(toWord)
    .filter((word) => word.word);

  return {
    text:
      parsed.data.text?.trim() || segments.map((segment) => segment.text).join(" ") || undefined,
    segments: nonEmpty(segments),
    words: nonEmpty(words),
  };
}

function readDeepgram(payload: unknown): TranscriptionTimings | null {
  const parsed = deepgramTranscriptSchema.safeParse(payload);

  if (!parsed.success) {
    return null;
  }

  const alternatives = parsed.data.results.channels.flatMap((channel) =>
    channel.alternatives?.[0] ? [channel.alternatives[0]] : [],
  );
  const words = alternatives
    .flatMap((alternative) => alternative.words ?? [])
    .map(toWord)
    .filter((word) => word.word);
  const text = alternatives
    .map((alternative) => alternative.transcript?.trim() ?? "")
    .filter(Boolean)
    .join("\n");

  return { text: text || undefined, words: nonEmpty(words) };
}

export function readTranscriptionTimings(payload: unknown): TranscriptionTimings {
  const candidates = [payload, z.object({ output: z.unknown() }).safeParse(payload).data?.output];

  for (const candidate of candidates) {
    if (candidate === undefined || candidate === null) {
      continue;
    }

    const timings = readDeepgram(candidate) ?? readSegmented(candidate);

    if (timings && (timings.text || timings.segments || timings.words)) {
      return timings;
    }
  }

  return {};
}
