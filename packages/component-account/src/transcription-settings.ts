import type { SavedSpeechVoice } from "@ngriffin_uk/polychat-schemas";

export const transcriptionProviderOptions = [
  {
    id: "workers",
    label: "Workers",
    models: [
      { id: "whisper", label: "OpenAI Whisper" },
      { id: "whisper-tiny", label: "OpenAI Whisper Tiny" },
    ],
  },
  {
    id: "mistral",
    label: "Mistral",
    models: [
      { id: "voxtral-mini", label: "Voxtral Mini Transcribe 3" },
      { id: "voxtral-small", label: "Voxtral Small Transcribe 3" },
    ],
  },
  {
    id: "replicate",
    label: "Replicate",
    models: [{ id: "replicate-whisper-diarization", label: "Whisper Diarization" }],
  },
  {
    id: "greenpt",
    label: "GreenPT",
    models: [
      { id: "green-s", label: "Green S" },
      { id: "green-s-pro", label: "Green S Pro" },
    ],
  },
] as const;

export type TranscriptionProviderId = (typeof transcriptionProviderOptions)[number]["id"];
export type TranscriptionModelOption =
  (typeof transcriptionProviderOptions)[number]["models"][number];
export type ResolvedTranscriptionSettings = {
  transcription_provider: TranscriptionProviderId;
  transcription_model: string;
};

const defaultTranscriptionProvider = transcriptionProviderOptions[0];

export const speechProviderOptions = [
  {
    id: "melotts",
    label: "MeloTTS",
    models: [{ id: "@cf/myshell-ai/melotts", label: "MeloTTS" }],
  },
  {
    id: "polly",
    label: "Amazon Polly",
    models: [{ id: "Ruth", label: "Ruth" }],
  },
  {
    id: "cartesia",
    label: "Cartesia",
    models: [{ id: "sonic-3", label: "Sonic 3" }],
  },
  {
    id: "elevenlabs",
    label: "ElevenLabs",
    models: [{ id: "eleven_multilingual_v2", label: "Multilingual v2" }],
  },
  {
    id: "mistral",
    label: "Mistral",
    models: [
      { id: "voice_1787", label: "Mary - English, UK" },
      { id: "voice_1786", label: "Sky - English, UK" },
      { id: "voice_1788", label: "David - English, UK" },
      { id: "voice_590", label: "Harriet - English, UK" },
      { id: "voice_591", label: "Fred - English, UK" },
      { id: "voice_3149", label: "Hugo - English, UK" },
      { id: "voice_3147", label: "Howard - English, UK" },
      { id: "voice_478", label: "Sheila - English, US" },
      { id: "voice_447", label: "Margaret - English, US" },
      { id: "voice_485", label: "Rob - English, US" },
      { id: "voice_3150", label: "James - English, US" },
      { id: "voice_592", label: "Marie - French" },
      { id: "voice_3137", label: "Manon - French" },
      { id: "voice_589", label: "Lea - French" },
      { id: "voice_3141", label: "Camille - French" },
      { id: "voice_483", label: "Elena - Spanish" },
      { id: "voice_481", label: "Heidi - German" },
      { id: "voice_482", label: "Lorenzo - Italian" },
      { id: "voice_480", label: "Gabriela - Portuguese" },
      { id: "voice_479", label: "Maryam - Arabic" },
      { id: "voice_3143", label: "Jordi - Catalan" },
      { id: "voice_3139", label: "Ananya - Hindi" },
      { id: "voice_3153", label: "Himanshu - Hindi" },
      { id: "voice_3146", label: "Olivia - Hungarian" },
      { id: "voice_3133", label: "Haruto - Japanese" },
      { id: "voice_3136", label: "Sung - Korean" },
      { id: "voice_3135", label: "Jin - Korean" },
      { id: "voice_3145", label: "Lotte - Dutch" },
      { id: "voice_3134", label: "Lars - Norwegian" },
      { id: "voice_3154", label: "Leon - Polish" },
      { id: "voice_3155", label: "Irina - Romanian" },
      { id: "voice_3132", label: "Tatiana - Russian" },
      { id: "voice_3138", label: "Oran - Turkish" },
      { id: "voice_3140", label: "Taras - Ukrainian" },
      { id: "voice_3144", label: "Huong - Vietnamese" },
      { id: "voice_3142", label: "Mei - Chinese" },
    ],
  },
] as const;

export type SpeechProviderId = (typeof speechProviderOptions)[number]["id"];
export type ResolvedSpeechSettings = {
  speech_provider: SpeechProviderId;
  speech_model: string;
};

const defaultSpeechProvider = speechProviderOptions[0];

export function getTranscriptionProviderOption(provider?: string | null) {
  return (
    transcriptionProviderOptions.find((option) => option.id === provider) ??
    defaultTranscriptionProvider
  );
}

export function getTranscriptionModelOptions(provider?: string | null) {
  return getTranscriptionProviderOption(provider).models;
}

export function resolveTranscriptionSettings(
  provider?: string | null,
  model?: string | null,
): ResolvedTranscriptionSettings {
  const providerOption = getTranscriptionProviderOption(provider);
  const matchingModel = providerOption.models.find((option) => option.id === model);

  return {
    transcription_provider: providerOption.id,
    transcription_model: matchingModel?.id ?? providerOption.models[0].id,
  };
}

export function getSpeechProviderOption(provider?: string | null) {
  return speechProviderOptions.find((option) => option.id === provider) ?? defaultSpeechProvider;
}

export function getSpeechModelOptions(
  provider?: string | null,
  savedVoices: readonly SavedSpeechVoice[] = [],
): readonly { id: string; label: string }[] {
  const providerOption = getSpeechProviderOption(provider);
  const ownVoices = savedVoices
    .filter((voice) => voice.provider === providerOption.id)
    .map((voice) => ({ id: voice.id, label: `${voice.name} - Your voice` }));

  return [...ownVoices, ...providerOption.models];
}

export function resolveSpeechSettings(
  provider?: string | null,
  model?: string | null,
  savedVoices: readonly SavedSpeechVoice[] = [],
): ResolvedSpeechSettings {
  const providerOption = getSpeechProviderOption(provider);
  const matchingModel = getSpeechModelOptions(providerOption.id, savedVoices).find(
    (option) => option.id === model,
  );

  return {
    speech_provider: providerOption.id,
    speech_model: matchingModel?.id ?? providerOption.models[0].id,
  };
}
