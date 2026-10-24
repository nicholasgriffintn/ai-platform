import type { PodcastScriptTurn } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { synthesiseSpeech } from "~/modules/audio/application/speech";
import { resolveSpeechVoice } from "~/modules/audio/application/speech-voice";
import { UserSettingsRepository } from "~/modules/user/infrastructure/UserSettingsRepository";

export const PODCAST_HOSTS = {
  host: { name: "Ava" },
  guest: { name: "Leo" },
} as const satisfies Record<PodcastScriptTurn["speaker"], { name: string }>;

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

export async function synthesisePodcastAudio(
  context: ServiceContext,
  turns: PodcastScriptTurn[],
  language: string,
): Promise<Uint8Array> {
  const user = context.requireUser();
  const settings = await new UserSettingsRepository(context.env).getUserSettings(user.id);
  const [host, guest] = await Promise.all([
    resolveSpeechVoice(context.env, user, { role: "host", settings }),
    resolveSpeechVoice(context.env, user, { role: "guest", settings }),
  ]);
  const voices = { host, guest };
  const segments: Uint8Array[] = [];

  for (const turn of turns) {
    for (const text of splitForSpeech(turn.text)) {
      segments.push(await synthesiseSpeech(context, voices[turn.speaker], text, language));
    }
  }

  return joinAudioSegments(segments);
}
