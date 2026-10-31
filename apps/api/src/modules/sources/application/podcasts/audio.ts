import type { PodcastScriptTurn } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { synthesiseSpeechText } from "~/modules/audio/application/speech";
import { resolveSpeechVoice } from "~/modules/audio/application/speech-voice";
import { renderWithSpeechVoices } from "~/modules/audio/application/speech-voices";
import { joinAudioSegments, mp3SegmentSeconds } from "~/modules/audio/domain/mp3";
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

        for (const segment of await synthesiseSpeechText(
          context,
          voices[turn.speaker],
          turn.text,
          language,
        )) {
          segments.push(segment);
          elapsed += mp3SegmentSeconds(segment);
        }
      }

      if (segments.length === 0) {
        throw new AssistantError("No speech was generated", ErrorType.PROVIDER_ERROR);
      }

      return { audio: joinAudioSegments(segments), turnStarts, durationSeconds: elapsed };
    },
  );
}
