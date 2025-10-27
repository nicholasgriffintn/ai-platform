import { getModelConfigByModel } from "~/lib/models";
import { validateReplicatePayload } from "~/lib/models/utils/replicateValidation";
import { AIProviderFactory } from "~/lib/providers/factory";
import { RepositoryManager } from "~/repositories";
import type { IEnv, IFunctionResponse, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "services/apps/podcast/transcribe" });

const MODEL_KEY = "replicate-whisper-large-v3";

export interface IPodcastTranscribeBody {
  podcastId: string;
  numberOfSpeakers: number;
  prompt: string;
}

interface TranscribeRequest {
  env: IEnv;
  request: IPodcastTranscribeBody;
  user: IUser;
  app_url?: string;
}

export const handlePodcastTranscribe = async (
  req: TranscribeRequest,
): Promise<IFunctionResponse | IFunctionResponse[]> => {
  const { request, env, user, app_url } = req;

  if (!request.podcastId || !request.prompt || !request.numberOfSpeakers) {
    throw new AssistantError(
      "Missing podcast id or prompt or number of speakers",
      ErrorType.PARAMS_ERROR,
    );
  }

  try {
    if (!env.DB) {
      throw new AssistantError("Missing database", ErrorType.PARAMS_ERROR);
    }

    if (!user?.id) {
      throw new AssistantError("User data required", ErrorType.PARAMS_ERROR);
    }

    const repositories = RepositoryManager.getInstance(env);

    const existingTranscriptions =
      await repositories.appData.getAppDataByUserAppAndItem(
        user.id,
        "podcasts",
        request.podcastId,
        "transcribe",
      );

    if (existingTranscriptions.length > 0) {
      let transcriptionData;
      try {
        transcriptionData = JSON.parse(
          existingTranscriptions[0].data,
        ).transcriptionData;
      } catch (e) {
        logger.error("Failed to parse transcription data", { error: e });
        transcriptionData = {};
      }
      return {
        status: "success",
        content: "Podcast Transcription retrieved from cache",
        data: transcriptionData,
      };
    }

    const uploadData = await repositories.appData.getAppDataByUserAppAndItem(
      user.id,
      "podcasts",
      request.podcastId,
      "upload",
    );

    if (uploadData.length === 0) {
      throw new AssistantError(
        "Podcast upload not found. Please upload audio first",
        ErrorType.PARAMS_ERROR,
      );
    }

    let parsedUploadData: Record<string, any>;
    try {
      parsedUploadData = JSON.parse(uploadData[0].data);
    } catch (e) {
      logger.error("Failed to parse upload data", { error: e });
      parsedUploadData = {};
    }
    const title = parsedUploadData.title;
    const description = parsedUploadData.description;
    const audioUrl = parsedUploadData.audioUrl;

    const modelConfig = await getModelConfigByModel(MODEL_KEY);

    if (!modelConfig) {
      throw new AssistantError(
        `Model configuration not found for ${MODEL_KEY}`,
        ErrorType.CONFIGURATION_ERROR,
      );
    }
    const provider = AIProviderFactory.getProvider(
      modelConfig.provider || "replicate",
    );

    const prompt = `${request.prompt} <title>${title}</title> <description>${description}</description>`;

    const replicatePayload = Object.fromEntries(
      Object.entries({
        file: audioUrl,
        prompt,
        language: "en",
        num_speakers: request.numberOfSpeakers,
        transcript_output_format: "segments_only",
        group_segments: true,
        translate: false,
        offset_seconds: 0,
      }).filter(([, value]) => value !== undefined && value !== null),
    );

    validateReplicatePayload({
      payload: replicatePayload,
      schema: modelConfig.replicateInputSchema,
      modelName: modelConfig.name || MODEL_KEY,
    });

    const transcriptionData = await provider.getResponse({
      completion_id: request.podcastId,
      app_url,
      model: modelConfig.matchingModel,
      messages: [
        {
          role: "user",
          content: [{ ...replicatePayload, type: "text" }],
        },
      ],
      env,
      user,
    });

    const isAsync = transcriptionData?.status === "in_progress";

    const appData = {
      title,
      description,
      numberOfSpeakers: request.numberOfSpeakers,
      prompt: request.prompt,
      transcriptionData,
      status: isAsync ? "pending" : "complete",
      createdAt: new Date().toISOString(),
    };

    await repositories.appData.createAppDataWithItem(
      user.id,
      "podcasts",
      request.podcastId,
      "transcribe",
      appData,
    );

    return {
      status: "success",
      content: isAsync
        ? `Podcast transcription started: ${transcriptionData.id}`
        : `Podcast transcribed: ${transcriptionData.id}`,
      data: appData,
    };
  } catch (error) {
    logger.error("Failed to transcribe podcast:", {
      error_message: error instanceof Error ? error.message : "Unknown error",
    });
    throw new AssistantError("Failed to transcribe podcast");
  }
};
