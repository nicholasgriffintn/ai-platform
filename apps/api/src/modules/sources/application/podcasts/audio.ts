import type { PodcastScriptTurn } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { synthesiseSpeech } from "~/modules/audio/application/speech";
import { resolveSpeechVoice } from "~/modules/audio/application/speech-voice";
import { renderWithSpeechVoices } from "~/modules/audio/application/speech-voices";
import { joinAudioSegments, mp3SegmentSeconds } from "~/modules/audio/domain/mp3";
import { splitForSpeech } from "~/modules/audio/domain/speech-text";
import { UserSettingsRepository } from "~/modules/user/infrastructure/UserSettingsRepository";

export const PODCAST_HOSTS = {
  host: { name: "Ava" },
  guest: { name: "Leo" },
} as const satisfies Record<PodcastScriptTurn["speaker"], { name: string }>;

export interface PodcastAudio {
  audio: Uint8Array;
  turnStarts: number[];
  durationSeconds: number;
}

export async function synthesisePodcastAudio(
  context: ServiceContext,
  turns: PodcastScriptTurn[],
  language: string,
): Promise<PodcastAudio> {
  const user = context.requireUser();
  const settings = await new UserSettingsRepository(context.env).getUserSettings(user.id);

  return renderWithSpeechVoices(
    async () => {
      const [host, guest] = await Promise.all([
        resolveSpeechVoice(context.env, user, { role: "host", settings }),
        resolveSpeechVoice(context.env, user, { role: "guest", settings }),
      ]);

      return { host, guest };
    },
    async (voices) => {
      const segments: Uint8Array[] = [];
      const turnStarts: number[] = [];
      let elapsed = 0;

      for (const turn of turns) {
        turnStarts.push(elapsed);

        for (const text of splitForSpeech(turn.text)) {
          const segment = await synthesiseSpeech(context, voices[turn.speaker], text, language);

          segments.push(segment);
          elapsed += mp3SegmentSeconds(segment);
        }
      }

      return { audio: joinAudioSegments(segments), turnStarts, durationSeconds: elapsed };
    },
  );
}
