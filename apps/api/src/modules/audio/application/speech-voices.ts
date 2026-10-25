import { runWithModelFallback } from "~/modules/models/application/model-fallback";

import type { SpeechVoiceSelection } from "./speech-voice";

type SpeechVoices = Record<string, SpeechVoiceSelection>;

function sameSpeechModels(left: SpeechVoices, right: SpeechVoices): boolean {
  return Object.keys(left).every((role) => left[role].id === right[role]?.id);
}

export async function renderWithSpeechVoices<TVoices extends SpeechVoices, TResult>(
  resolve: () => Promise<TVoices>,
  render: (voices: TVoices) => Promise<TResult>,
): Promise<TResult> {
  const { result } = await runWithModelFallback(
    await resolve(),
    { reselect: resolve, sameAs: sameSpeechModels },
    render,
  );

  return result;
}
