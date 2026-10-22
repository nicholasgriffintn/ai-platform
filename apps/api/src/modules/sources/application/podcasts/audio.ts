import { resolveAiGatewayId } from "@ngriffin_uk/polychat-ai-providers";
import type { PodcastScriptTurn } from "@ngriffin_uk/polychat-schemas";
import { readStreamBytes } from "@ngriffin_uk/polychat-utility-core";
import { base64ToBuffer } from "@ngriffin_uk/polychat-utility-server/base64";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";

export const PODCAST_HOSTS = {
  host: { name: "Ava", voice: "asteria" },
  guest: { name: "Leo", voice: "arcas" },
} as const satisfies Record<PodcastScriptTurn["speaker"], { name: string; voice: string }>;

const ENGLISH_SPEECH_MODEL = "@cf/deepgram/aura-1";
const MULTILINGUAL_SPEECH_MODEL = "@cf/myshell-ai/melotts";
const MAX_SPEECH_CHARACTERS = 1800;
const WORDS_PER_MINUTE = 150;

/** Splits a turn at sentence boundaries so each piece fits a single speech request. */
export function splitForSpeech(text: string, maxCharacters = MAX_SPEECH_CHARACTERS): string[] {
  const sentences = text.match(/[^.!?]+(?:[.!?]+|$)/g) ?? [text];
  const pieces: string[] = [];
  let current = "";

  for (const sentence of sentences.map((value) => value.trim()).filter(Boolean)) {
    const candidate = current ? `${current} ${sentence}` : sentence;

    if (candidate.length <= maxCharacters) {
      current = candidate;
      continue;
    }

    if (current) {
      pieces.push(current);
    }

    for (let start = 0; start < sentence.length; start += maxCharacters) {
      const slice = sentence.slice(start, start + maxCharacters);

      if (start + maxCharacters >= sentence.length) {
        current = slice;
      } else {
        pieces.push(slice);
      }
    }
  }

  if (current) {
    pieces.push(current);
  }

  return pieces;
}

/** Removes a leading ID3v2 tag so MP3 segments can be joined into one continuous stream. */
export function stripId3Tag(bytes: Uint8Array): Uint8Array {
  if (bytes.length < 10 || bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33) {
    return bytes;
  }

  const size =
    ((bytes[6] & 0x7f) << 21) |
    ((bytes[7] & 0x7f) << 14) |
    ((bytes[8] & 0x7f) << 7) |
    (bytes[9] & 0x7f);
  const hasFooter = (bytes[5] & 0x10) !== 0;
  const tagLength = 10 + size + (hasFooter ? 10 : 0);

  return bytes.subarray(Math.min(tagLength, bytes.length));
}

export function joinAudioSegments(segments: Uint8Array[]): Uint8Array {
  const frames = segments.map(stripId3Tag);
  const joined = new Uint8Array(frames.reduce((total, frame) => total + frame.length, 0));
  let offset = 0;

  for (const frame of frames) {
    joined.set(frame, offset);
    offset += frame.length;
  }

  return joined;
}

export function estimateSpokenSeconds(turns: PodcastScriptTurn[]): number {
  const words = turns.reduce((total, turn) => total + turn.text.split(/\s+/).length, 0);

  return Math.round((words / WORDS_PER_MINUTE) * 60);
}

async function readSpeech(result: unknown): Promise<Uint8Array> {
  if (result instanceof ReadableStream) {
    return readStreamBytes(result);
  }

  if (result instanceof ArrayBuffer) {
    return new Uint8Array(result);
  }

  if (result instanceof Uint8Array) {
    return result;
  }

  if (result && typeof result === "object" && "audio" in result) {
    const audio = (result as { audio?: unknown }).audio;

    if (typeof audio === "string" && audio) {
      return new Uint8Array(base64ToBuffer(audio));
    }
  }

  throw new AssistantError("Speech was not generated", ErrorType.PROVIDER_ERROR);
}

export async function synthesisePodcastAudio(
  context: ServiceContext,
  turns: PodcastScriptTurn[],
  language: string,
): Promise<Uint8Array> {
  const user = context.requireUser();
  const english = language.toLowerCase().startsWith("en");
  const segments: Uint8Array[] = [];
  const gateway = {
    gateway: { id: resolveAiGatewayId(), skipCache: false, metadata: { email: user.email } },
  };

  for (const turn of turns) {
    for (const text of splitForSpeech(turn.text)) {
      const result = english
        ? await context.env.AI.run(
            ENGLISH_SPEECH_MODEL,
            { text, speaker: PODCAST_HOSTS[turn.speaker].voice, encoding: "mp3" },
            gateway,
          )
        : await context.env.AI.run(
            MULTILINGUAL_SPEECH_MODEL,
            { prompt: text, lang: language },
            gateway,
          );

      segments.push(await readSpeech(result));
    }
  }

  return joinAudioSegments(segments);
}
