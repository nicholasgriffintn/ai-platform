import {
  VERBATIM_SEGMENT_MAX_BYTES,
  isDecisionAnswerOfType,
  readDecisionNoul,
  normaliseDecisionScore,
  roundDecisionScore,
  type DecisionAnswer,
  type DecisionResponse,
  type VerbatimSegment,
} from "@ngriffin_uk/polychat-schemas";
import { capitaliseFirst, measureDuration, splitWords } from "@ngriffin_uk/polychat-utility-core";
import { bufferToBase64 } from "@ngriffin_uk/polychat-utility-server/base64";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { handleTranscribe } from "~/modules/audio/application/transcribe";
import { decide } from "~/modules/decisions/application/decide";
import type { IEnv, IUser } from "~/types";

import {
  NOISE_LEVELS,
  PACE_LEVELS,
  TONES,
  VERBATIM_MAX_JUDGED_WORDS,
  buildRepairQuestions,
  buildSegmentQuestions,
  wordQuestionId,
} from "./questions";
import { applyRepair, planRepair } from "./repair";

const SPEECH_THRESHOLD = 0.5;

interface TranscribeSegmentOptions {
  env: IEnv;
  user: IUser;
  audio: File;
  context?: string;
  onDraft?: (text: string) => void;
}

const TONE_SCALE = Object.keys(TONES).map(capitaliseFirst);

function scoreReading(answers: Record<string, DecisionAnswer>, id: string, scale: string[]) {
  const answer = answers[id];

  return isDecisionAnswerOfType(answer, "score")
    ? {
        label: scale[roundDecisionScore(answer)] ?? "",
        score: normaliseDecisionScore(answer),
        scale,
      }
    : { label: "", score: 0, scale };
}

function toneReading(answers: Record<string, DecisionAnswer>) {
  const answer = answers.tone;

  return isDecisionAnswerOfType(answer, "choice")
    ? { label: capitaliseFirst(answer.choice), score: answer.confidence, scale: TONE_SCALE }
    : { label: "", score: 0, scale: TONE_SCALE };
}

export function assertVerbatimSegmentSize(audio: File): void {
  if (audio.size > VERBATIM_SEGMENT_MAX_BYTES) {
    throw new AssistantError("Audio segments must be under 2MB", ErrorType.PARAMS_ERROR, 413);
  }
}

export async function transcribeVerbatimSegment({
  env,
  user,
  audio,
  context,
  onDraft,
}: TranscribeSegmentOptions): Promise<VerbatimSegment> {
  assertVerbatimSegmentSize(audio);

  const [transcription, transcribeMs] = await measureDuration(() =>
    handleTranscribe({ env, user, audio: { kind: "file", file: audio } }),
  );
  const rawText = transcription.content.trim();
  const words = splitWords(rawText);

  if (words.length === 0) {
    return { status: "silence", timings: { transcribeMs, decideMs: 0, repairMs: 0 } };
  }

  onDraft?.(rawText);

  const audioUrl = `data:audio/wav;base64,${bufferToBase64(await audio.arrayBuffer())}`;
  const state = { transcript: rawText, previous: context?.trim() || "(start of recording)" };
  const [judged, decideMs] = await measureDuration(() =>
    decide({
      env,
      user,
      request: { state, audio: [audioUrl], questions: buildSegmentQuestions(words) },
    }),
  );
  const speech = readDecisionNoul(judged.answers, "speech");

  if (speech < SPEECH_THRESHOLD) {
    return {
      status: "no_speech",
      rawText,
      speech,
      timings: { transcribeMs, decideMs, repairMs: 0 },
    };
  }

  const probabilities = words.map((_, index) =>
    index < VERBATIM_MAX_JUDGED_WORDS
      ? readDecisionNoul(judged.answers, wordQuestionId(index))
      : null,
  );
  const plan = planRepair(words, probabilities);
  let repaired: ReturnType<typeof applyRepair> | null = null;
  let repairResponse: DecisionResponse | null = null;
  let repairMs = 0;

  if (plan) {
    [repairResponse, repairMs] = await measureDuration(() =>
      decide({
        env,
        user,
        request: { state, audio: [audioUrl], questions: buildRepairQuestions(plan.candidates) },
      }),
    );
    const answer = repairResponse.answers.candidate;

    if (isDecisionAnswerOfType(answer, "choice")) {
      repaired = applyRepair(words, probabilities, plan, answer);
    }
  }

  const finalWords =
    repaired?.words ??
    words.map((text, index) => ({
      text,
      probability: probabilities[index] ?? null,
      removed: false,
    }));

  return {
    status: "transcribed",
    text: finalWords
      .filter((word) => !word.removed)
      .map((word) => word.text)
      .join(" "),
    rawText,
    words: finalWords,
    checks: {
      speech,
      verbatim: readDecisionNoul(judged.answers, "verbatim"),
      fluent: readDecisionNoul(judged.answers, "fluent"),
      coherent: readDecisionNoul(judged.answers, "coherent"),
    },
    delivery: {
      pace: scoreReading(judged.answers, "pace", PACE_LEVELS),
      noise: scoreReading(judged.answers, "noise", NOISE_LEVELS),
      tone: toneReading(judged.answers),
    },
    repair: repaired?.repair ?? null,
    model: judged.model,
    usage: {
      input_tokens: judged.usage.input_tokens + (repairResponse?.usage.input_tokens ?? 0),
      output_tokens: judged.usage.output_tokens + (repairResponse?.usage.output_tokens ?? 0),
    },
    timings: { transcribeMs, decideMs, repairMs },
  };
}
