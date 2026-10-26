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

export async function resolveSpeechVoice(
  env: IEnv,
  user: IUser | undefined,
  request: SpeechVoiceRequest,
): Promise<SpeechVoiceSelection> {
  const { settings, role } = request;
  const explicit = Boolean(request.provider || request.model);
  const selected = await getSpeechModel(env, user, {
    provider: request.provider ?? settings?.speech_provider,
    model:
      request.model ?? request.pinned?.model ?? (request.provider ? null : settings?.speech_model),
    required: explicit,
  });
  const requestedVoice =
    request.voice ?? (selected.id === request.pinned?.model ? request.pinned.voice : undefined);
  const configuredVoice =
    role === "narrator" && selected.provider === settings?.speech_provider
      ? settings.speech_voice
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
