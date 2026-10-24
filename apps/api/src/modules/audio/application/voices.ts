import { isMistralPresetVoiceId } from "@ngriffin_uk/polychat-ai-providers";
import { hasProEntitlement } from "@ngriffin_uk/polychat-library-policy";
import { MAX_SAVED_SPEECH_VOICES, type SavedSpeechVoice } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { getAudioProvider } from "~/infrastructure/providers/capabilities/audio";
import { hasUserProviderApiKey } from "~/infrastructure/providers/credentials";
import { UserSettingsRepository } from "~/modules/user/infrastructure/UserSettingsRepository";
import type { IEnv, IUser } from "~/types";

const VOICE_PROVIDER = "mistral";

function canUseMistralVoice(voiceId: string, savedVoices: readonly SavedSpeechVoice[]): boolean {
  return isMistralPresetVoiceId(voiceId) || savedVoices.some((voice) => voice.id === voiceId);
}

export function resolveMistralSpeechVoice({
  requestedVoice,
  configuredVoice,
  defaultVoice,
  savedVoices,
}: {
  requestedVoice?: string;
  configuredVoice?: string | null;
  defaultVoice: string;
  savedVoices: readonly SavedSpeechVoice[];
}): string {
  if (requestedVoice) {
    if (!canUseMistralVoice(requestedVoice, savedVoices)) {
      throw new AssistantError("Use a preset voice or one you saved", ErrorType.FORBIDDEN, 403);
    }

    return requestedVoice;
  }

  return configuredVoice && canUseMistralVoice(configuredVoice, savedVoices)
    ? configuredVoice
    : defaultVoice;
}

async function assertVoiceLibraryAccess(env: IEnv, user: IUser): Promise<void> {
  if (hasProEntitlement(user)) {
    return;
  }

  if (!(await hasUserProviderApiKey({ env, user, providerName: VOICE_PROVIDER }))) {
    throw new AssistantError(
      "Saving voices requires a configured Mistral provider key",
      ErrorType.AUTHORISATION_ERROR,
      403,
    );
  }
}

async function readSavedVoices(
  repository: UserSettingsRepository,
  userId: number,
): Promise<SavedSpeechVoice[]> {
  return (await repository.getUserSettings(userId))?.speech_voices ?? [];
}

export async function listSpeechVoices(env: IEnv, user: IUser): Promise<SavedSpeechVoice[]> {
  return readSavedVoices(new UserSettingsRepository(env), user.id);
}

export async function createSpeechVoice({
  env,
  user,
  name,
  sample,
}: {
  env: IEnv;
  user: IUser;
  name: string;
  sample: File;
}): Promise<SavedSpeechVoice> {
  await assertVoiceLibraryAccess(env, user);

  const repository = new UserSettingsRepository(env);
  const savedVoices = await readSavedVoices(repository, user.id);

  if (savedVoices.length >= MAX_SAVED_SPEECH_VOICES) {
    throw new AssistantError(
      `You can keep up to ${MAX_SAVED_SPEECH_VOICES} saved voices. Delete one first.`,
      ErrorType.PARAMS_ERROR,
    );
  }

  const provider = getAudioProvider(VOICE_PROVIDER, { env, user });

  if (!provider.createVoice) {
    throw new AssistantError("This provider cannot save voices", ErrorType.CONFIGURATION_ERROR);
  }

  const created = await provider.createVoice({
    env,
    user,
    name,
    sample,
    sampleFilename: sample.name || "voice-sample",
  });
  const voice: SavedSpeechVoice = {
    id: created.id,
    provider: VOICE_PROVIDER,
    name,
    created_at: new Date().toISOString(),
  };

  await repository.replaceSpeechVoices(user.id, [...savedVoices, voice]);

  return voice;
}

export async function deleteSpeechVoice({
  env,
  user,
  voiceId,
}: {
  env: IEnv;
  user: IUser;
  voiceId: string;
}): Promise<void> {
  const repository = new UserSettingsRepository(env);
  const settings = await repository.getUserSettings(user.id);
  const savedVoices = settings?.speech_voices ?? [];

  if (!savedVoices.some((voice) => voice.id === voiceId)) {
    throw new AssistantError("Voice not found", ErrorType.NOT_FOUND, 404);
  }

  const provider = getAudioProvider(VOICE_PROVIDER, { env, user });

  await provider.deleteVoice?.({ env, user, voiceId });
  await repository.replaceSpeechVoices(
    user.id,
    savedVoices.filter((voice) => voice.id !== voiceId),
  );

  if (settings?.speech_voice === voiceId) {
    await repository.updateUserSettings(user.id, { speech_voice: null });
  }
}
