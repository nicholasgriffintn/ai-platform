import type { ConversationManager } from "../../../lib/conversationManager";
import { getModelConfigByMatchingModel } from "../../../lib/models";
import { AIProviderFactory } from "../../../providers/factory";
import type { ChatRole, IEnv, IFunctionResponse, IUser } from "../../../types";
import { AssistantError, ErrorType } from "../../../utils/errors";

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
  conversationManager?: ConversationManager;
}

export const handlePodcastTranscribe = async (
  req: TranscribeRequest,
): Promise<IFunctionResponse | IFunctionResponse[]> => {
  const { request, env, user, app_url, conversationManager } = req;

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

    if (!conversationManager) {
      throw new AssistantError(
        "Missing conversation manager",
        ErrorType.PARAMS_ERROR,
      );
    }

    const chat = await conversationManager.get(request.podcastId);

    if (!chat?.length) {
      throw new AssistantError("Podcast not found", ErrorType.PARAMS_ERROR);
    }

    const uploadData = chat.find(
      (message) => message.name === "podcast_upload",
    );
    if (!uploadData?.data?.url) {
      throw new AssistantError("Podcast not found", ErrorType.PARAMS_ERROR);
    }

    const modelConfig = getModelConfigByMatchingModel(REPLICATE_MODEL_VERSION);
    const provider = AIProviderFactory.getProvider(
      modelConfig?.provider || "replicate",
    );

    const basewebhook_url = app_url || "https://chat-api.nickgriffin.uk";
    const webhook_url = `${basewebhook_url}/webhooks/replicate?completion_id=${request.podcastId}&token=${env.WEBHOOK_SECRET}`;

    const transcriptionData = await provider.getResponse({
      completion_id: request.podcastId,
      app_url,
      version: REPLICATE_MODEL_VERSION,
      messages: [
        {
          role: "user",
          content: {
            // @ts-ignore
            file: uploadData.data.url,
            prompt: request.prompt,
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
    });

    const message = {
      role: "assistant" as ChatRole,
      name: "podcast_transcribe",
      content: `Podcast Transcribed: ${transcriptionData.id}`,
      data: transcriptionData,
    };

    await conversationManager.add(request.podcastId, message);
    return {
      status: "success",
      content: `Podcast Transcribed: ${transcriptionData.id}`,
    };
  } catch (error) {
    throw new AssistantError("Failed to transcribe podcast");
  }
};
