import type { NarrationVoice } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { joinAudioSegments, mp3DurationSeconds } from "~/modules/audio/domain/mp3";
import {
  proportionalDurations,
  timePassages,
  type NarrationTiming,
} from "~/modules/audio/domain/narration-timing";
import { estimateSpokenSeconds, splitForSpeech } from "~/modules/audio/domain/speech-text";
import { UserSettingsRepository } from "~/modules/user/infrastructure/UserSettingsRepository";

import { synthesiseSpeech } from "./speech";
import { resolveSpeechVoice } from "./speech-voice";
import { renderWithSpeechVoices } from "./speech-voices";

export interface Narration {
  audio: Uint8Array;
  timings: NarrationTiming[];
}

export interface NarrationOptions {
  language: string;
  voice?: NarrationVoice;
  onVoice?: (voice: NarrationVoice) => Promise<void>;
  onPassage?: (index: number, audio: Uint8Array) => Promise<void>;
}

export async function narratePassages(
  context: ServiceContext,
  passages: readonly string[],
  options: NarrationOptions,
): Promise<Narration> {
  const user = context.requireUser();
  const settings = await new UserSettingsRepository(context.env).getUserSettings(user.id);
  const rendered = await renderWithSpeechVoices(
    async () => ({
      narrator: await resolveSpeechVoice(context.env, user, {
        role: "narrator",
        settings,
        pinned: options.voice,
      }),
    }),
    async ({ narrator }) => {
      const segments: Uint8Array[] = [];

      await options.onVoice?.({ model: narrator.id, voice: narrator.voice });

      for (const [index, passage] of passages.entries()) {
        const pieces: Uint8Array[] = [];

        for (const text of splitForSpeech(passage)) {
          pieces.push(await synthesiseSpeech(context, narrator, text, options.language));
        }

        const audio = joinAudioSegments(pieces);

        segments.push(audio);
        await options.onPassage?.(index, audio);
      }

      return segments;
    },
  );
  const measured = rendered.map((segment) => mp3DurationSeconds(segment));
  const durations = measured.every((seconds) => seconds > 0)
    ? measured
    : proportionalDurations(
        rendered.map((segment) => segment.byteLength),
        estimateSpokenSeconds(passages),
      );

  return { audio: joinAudioSegments(rendered), timings: timePassages(durations) };
}
