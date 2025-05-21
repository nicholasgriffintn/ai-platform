import { API_PROD_HOST } from "~/constants/app";
import { getModelConfigByMatchingModel } from "~/lib/models";
import { AIProviderFactory } from "~/lib/providers/factory";
import { RepositoryManager } from "~/repositories";
import type { IEnv, IFunctionResponse, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

const REPLICATE_MODEL_VERSION =
  "cbd15da9f839c5f932742f86ce7def3a03c22e2b4171d42823e83e314547003f";

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
      const transcriptionData = JSON.parse(
        existingTranscriptions[0].data,
      ).transcriptionData;
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

    const parsedUploadData = JSON.parse(uploadData[0].data);
    const title = parsedUploadData.title;
    const description = parsedUploadData.description;
    const audioUrl = parsedUploadData.audioUrl;

    const modelConfig = getModelConfigByMatchingModel(REPLICATE_MODEL_VERSION);
    const provider = AIProviderFactory.getProvider(
      modelConfig?.provider || "replicate",
    );

    const basewebhook_url = app_url || `https://${API_PROD_HOST}`;
    const webhook_url = `${basewebhook_url}/webhooks/replicate?completion_id=${request.podcastId}&token=${env.WEBHOOK_SECRET}`;

    const prompt = `${request.prompt} <title>${title}</title> <description>${description}</description>`;

    const transcriptionData = await provider.getResponse({
      completion_id: request.podcastId,
      app_url,
      version: REPLICATE_MODEL_VERSION,
      messages: [
        {
          role: "user",
          content: {
            // @ts-ignore - Replicate model requires this format
            file: audioUrl,
            prompt,
            language: "en",
            num_speakers: request.numberOfSpeakers,
            transcript_output_format: "segments_only",
            group_segments: true,
            translate: false,
            offset_seconds: 0,
          },
        },
      ],
      env,
      user,
      webhook_url,
      webhook_events: ["output", "completed"],
      should_poll: true,
    });

    const appData = {
      title,
      description,
      numberOfSpeakers: request.numberOfSpeakers,
      prompt: request.prompt,
      transcriptionData,
      status: "complete",
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
      content: `Podcast Transcribed: ${transcriptionData.id}`,
      data: appData,
    };
  } catch (error) {
    console.error("Failed to transcribe podcast:", error);
    throw new AssistantError("Failed to transcribe podcast");
  }
};
