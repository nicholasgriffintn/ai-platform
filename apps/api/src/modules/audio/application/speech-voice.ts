import {
  SPEECH_PROVIDER_VOICES,
  type NarrationVoice,
  type SpeechProvider,
  type SpeechVoiceRole,
} from "@ngriffin_uk/polychat-schemas";

import { getSpeechModel, type ResolvedSpeechModel } from "~/modules/models/application/resolve";
import type { IEnv, IUser, IUserSettings } from "~/types";

import { resolveMistralSpeechVoice } from "./voices";

export interface SpeechVoiceSelection extends ResolvedSpeechModel {
  voice: string;
}

export interface SpeechVoiceRequest {
  role: SpeechVoiceRole;
  settings?: IUserSettings | null;
  provider?: SpeechProvider;
  model?: string;
  voice?: string;
  pinned?: NarrationVoice;
}

function isProviderVoice(provider: SpeechProvider, settings?: IUserSettings | null): boolean {
  const voice = settings?.speech_voice;

  return Boolean(
    voice &&
    (SPEECH_PROVIDER_VOICES[provider].voices.some((option) => option.id === voice) ||
      settings?.speech_voices.some((saved) => saved.provider === provider && saved.id === voice)),
  );
}

export async function resolveSpeechVoice(
  env: IEnv,
  user: IUser | undefined,
  request: SpeechVoiceRequest,
): Promise<SpeechVoiceSelection> {
  const { settings, role } = request;
  const explicit = Boolean(request.provider || request.model);
  const selected = await getSpeechModel(env, user, {
    provider: request.provider,
    model: request.model ?? request.pinned?.model,
    required: explicit,
  });
  const requestedVoice =
    request.voice ?? (selected.id === request.pinned?.model ? request.pinned.voice : undefined);
  const configuredVoice =
    role === "narrator" && isProviderVoice(selected.provider, settings)
      ? settings?.speech_voice
      : null;
  const roleVoice = SPEECH_PROVIDER_VOICES[selected.provider].roles[role];

  if (selected.provider === "mistral") {
    return {
      ...selected,
      voice: resolveMistralSpeechVoice({
        requestedVoice,
        configuredVoice,
        defaultVoice: roleVoice,
        savedVoices: settings?.speech_voices ?? [],
      }),
    };
  }

  return { ...selected, voice: requestedVoice ?? configuredVoice ?? roleVoice };
}
