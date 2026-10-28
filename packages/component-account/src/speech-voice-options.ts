import {
  SPEECH_PROVIDER_VOICES,
  type SavedSpeechVoice,
  type SpeechProvider,
  type SpeechVoice,
} from "@ngriffin_uk/polychat-schemas";

export function getSpeechVoiceOptions(
  provider: SpeechProvider,
  savedVoices: readonly SavedSpeechVoice[] = [],
): readonly SpeechVoice[] {
  const ownVoices = savedVoices
    .filter((voice) => voice.provider === provider)
    .map((voice) => ({ id: voice.id, label: `${voice.name} - Your voice` }));

  return [...ownVoices, ...SPEECH_PROVIDER_VOICES[provider].voices];
}
