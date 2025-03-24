import { gatewayId } from "../../../constants/app";
import type { ConversationManager } from "../../../lib/conversationManager";
import type { ChatRole, IEnv, IFunctionResponse, IUser } from "../../../types";
import { AssistantError, ErrorType } from "../../../utils/errors";

function generateFullTranscription(
  transcription: {
    segments: { speaker: any; text: any }[];
  },
  speakers: {
    [name: string]: string;
  },
) {
  const fullTranscription = transcription.segments
    .map((segment: any) => {
      const speaker = speakers[segment.speaker];
      return `${speaker}: ${segment.text}`;
    })
    .join("\n");

  return fullTranscription;
}

export interface IPodcastSummariseBody {
  podcastId: string;
  speakers: { [name: string]: string };
}

type SummariseRequest = {
  env: IEnv;
  request: IPodcastSummariseBody;
  user: IUser;
  app_url?: string;
  conversationManager?: ConversationManager;
};

export const handlePodcastSummarise = async (
  req: SummariseRequest,
): Promise<IFunctionResponse | IFunctionResponse[]> => {
  const { request, env, user, conversationManager } = req;

  if (!request.podcastId || !request.speakers) {
    throw new AssistantError(
      "Missing podcast id or speakers",
      ErrorType.PARAMS_ERROR,
    );
  }

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

  const transcriptionData = chat.find(
    (message) => message.name === "podcast_transcribe",
  );

  if (!transcriptionData?.data?.output) {
    throw new AssistantError("Transcription not found", ErrorType.PARAMS_ERROR);
  }

  const transcription = transcriptionData.data.output;
  const fullTranscription = generateFullTranscription(
    transcription,
    request.speakers,
  );

  const data = await env.AI.run(
    "@cf/facebook/bart-large-cnn",
    {
      input_text: fullTranscription,
      max_length: 52,
    },
    {
      gateway: {
        id: gatewayId,
        skipCache: false,
        cacheTtl: 3360,
        metadata: {
          email: user?.email,
        },
      },
    },
  );

  if (!data.summary) {
    throw new AssistantError("No response from the model");
  }

  const message = {
    role: "assistant" as ChatRole,
    name: "podcast_summarise",
    content: data.summary,
    data: {
      summary: data.summary,
      speakers: request.speakers,
    },
  };
  const response = await conversationManager.add(request.podcastId, message);

  return response;
};
