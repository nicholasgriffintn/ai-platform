import { hasProEntitlement } from "@ngriffin_uk/polychat-library-policy";
import type { TranscriptionResult } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { getTranscriptionProvider } from "~/infrastructure/providers/capabilities/transcription";
import { hasUserProviderApiKey } from "~/infrastructure/providers/credentials";
import { getAuxiliarySpeechModel } from "~/modules/models/application/resolve";
import { UserSettingsRepository } from "~/modules/user/infrastructure/UserSettingsRepository";
import type { IEnv, IUser } from "~/types";

import { assertValidTranscriptionFile, type TranscriptionAudioSource } from "./transcription-input";

const TRANSCRIPTION_PROVIDERS = ["workers", "mistral", "replicate", "greenpt"] as const;

export type TranscriptionProvider = (typeof TRANSCRIPTION_PROVIDERS)[number];

type TranscribeRequest = {
  env: IEnv;
  audio: TranscriptionAudioSource;
  user: IUser;
  allowVideo?: boolean;
  provider?: TranscriptionProvider;
  timestamps?: boolean;
};

export const handleTranscribe = async (req: TranscribeRequest): Promise<TranscriptionResult> => {
  const { allowVideo = false, audio, env, user, provider, timestamps = false } = req;

  if (!audio) {
    throw new AssistantError("Missing audio", ErrorType.PARAMS_ERROR);
  }

  if (audio.kind === "file") {
    await assertValidTranscriptionFile(audio.file, { allowVideo });
  }

  try {
    let selectedProvider = provider;
    let selectedModel: string | undefined;
    const userSettings = user?.id
      ? await new UserSettingsRepository(env).getUserSettings(user.id)
      : null;

    if (!selectedProvider) {
      const speechModel = await getAuxiliarySpeechModel(env, userSettings, user);

      if (!isTranscriptionProvider(speechModel.transcriptionProvider)) {
        throw new AssistantError(
          "Configured transcription provider is not supported",
          ErrorType.CONFIGURATION_ERROR,
        );
      }

      selectedProvider = speechModel.transcriptionProvider;
      selectedModel = speechModel.model;
    }

    const resolvedProvider = selectedProvider || "workers";

    if (!hasProEntitlement(user)) {
      if (!(await hasUserProviderApiKey({ env, user, providerName: resolvedProvider }))) {
        throw new AssistantError(
          `Transcription requires a configured ${resolvedProvider} provider key`,
          ErrorType.AUTHORISATION_ERROR,
          403,
        );
      }
    }

    const transcriptionProvider = getTranscriptionProvider(resolvedProvider, {
      env,
      user,
    });

    const result = await transcriptionProvider.transcribe({
      env,
      audio,
      user,
      provider: resolvedProvider,
      model: selectedModel,
      timestamps,
      vocabulary: userSettings?.transcription_vocabulary,
    });

    return {
      status: "success",
      content: result.text,
      ...(timestamps ? { segments: result.segments, words: result.words } : {}),
    };
  } catch (error) {
    if (error instanceof AssistantError) {
      throw error;
    }

    throw new AssistantError(
      `Transcription failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      ErrorType.EXTERNAL_API_ERROR,
    );
  }
};

function isTranscriptionProvider(value: string | undefined): value is TranscriptionProvider {
  return TRANSCRIPTION_PROVIDERS.some((provider) => provider === value);
}
