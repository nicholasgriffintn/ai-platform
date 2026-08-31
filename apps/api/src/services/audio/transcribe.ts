import type { TranscriptionResult } from "@ngriffin_uk/polychat-schemas";

import { getTranscriptionProvider } from "~/lib/providers/capabilities/transcription";
import { getAuxiliarySpeechModel } from "~/lib/providers/models";
import { hasUserProviderApiKey } from "~/lib/providers/utils/apiKeys";
import { RepositoryManager } from "~/repositories";
import type { IEnv, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

import { assertValidTranscriptionFile, type TranscriptionAudioSource } from "./transcription-input";

export type TranscriptionProvider = "workers" | "mistral" | "replicate";

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

    if (!selectedProvider) {
      const repositories = new RepositoryManager(env);
      const userSettings = user?.id
        ? await repositories.userSettings.getUserSettings(user.id)
        : null;

      const speechModel = await getAuxiliarySpeechModel(env, userSettings);

      if (!isTranscriptionProvider(speechModel.transcriptionProvider)) {
        throw new AssistantError(
          "Configured transcription provider is not supported",
          ErrorType.CONFIGURATION_ERROR,
        );
      }

      selectedProvider = speechModel.transcriptionProvider;
    }

    const resolvedProvider = selectedProvider || "workers";

    if (user?.plan_id !== "pro") {
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
      timestamps,
    });

    return {
      status: "success",
      content: result.text,
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
  return value === "workers" || value === "mistral" || value === "replicate";
}
