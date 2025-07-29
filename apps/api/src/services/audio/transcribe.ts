import { TranscriptionProviderFactory } from "~/lib/transcription/factory";
import type { IEnv, IFunctionResponse, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

type TranscribeRequest = {
  env: IEnv;
  audio: File | Blob | string;
  user: IUser;
  provider?: "workers" | "mistral";
  timestamps?: boolean;
};

export const handleTranscribe = async (
  req: TranscribeRequest,
): Promise<IFunctionResponse | IFunctionResponse[]> => {
  const { audio, env, user, provider = "workers", timestamps = false } = req;

  if (!audio) {
    throw new AssistantError("Missing audio", ErrorType.PARAMS_ERROR);
  }

  try {
    const transcriptionProvider =
      TranscriptionProviderFactory.getProvider(provider);

    const result = await transcriptionProvider.transcribe({
      env,
      audio,
      user,
      provider,
      timestamps,
    });

    return {
      status: "success",
      content: result.text,
      data: result.data,
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
