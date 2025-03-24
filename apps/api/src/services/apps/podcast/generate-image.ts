import { gatewayId } from "../../../constants/app";
import type { ConversationManager } from "../../../lib/conversationManager";
import { StorageService } from "../../../lib/storage";
import type { ChatRole, IEnv, IFunctionResponse, IUser } from "../../../types";
import { AssistantError, ErrorType } from "../../../utils/errors";

export interface IPodcastGenerateImageBody {
  podcastId: string;
}

type GenerateImageRequest = {
  env: IEnv;
  request: IPodcastGenerateImageBody;
  user: IUser;
  app_url?: string;
  conversationManager?: ConversationManager;
};

export const handlePodcastGenerateImage = async (
  req: GenerateImageRequest,
): Promise<IFunctionResponse | IFunctionResponse[]> => {
  const { request, env, user, conversationManager } = req;

  if (!request.podcastId) {
    throw new AssistantError("Missing podcast id", ErrorType.PARAMS_ERROR);
  }

  if (!conversationManager) {
    throw new AssistantError(
      "Missing conversation manager",
      ErrorType.PARAMS_ERROR,
    );
  }

  const chat = await req.conversationManager.get(request.podcastId);

  if (!chat?.length) {
    throw new AssistantError("Podcast not found", ErrorType.PARAMS_ERROR);
  }

  const summaryData = chat.find(
    (message) => message.name === "podcast_summarise",
  );

  if (!summaryData?.content) {
    throw new AssistantError("Podcast summary not found");
  }

  const summary = `I need a featured image for my latest podcast episode, this is the summary: ${summaryData.content}`;

  const data = await env.AI.run(
    "@cf/bytedance/stable-diffusion-xl-lightning",
    {
      prompt: summary,
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

  if (!data) {
    throw new AssistantError("Image not generated");
  }

  const itemId = Math.random().toString(36);
  const imageKey = `podcasts/${itemId}/featured.png`;

  const reader = data.getReader();
  const chunks = [];
  const done = false;
  while (!done) {
    const { done, value } = await reader.read();
    if (value) {
      chunks.push(value);
    }
  }
  const arrayBuffer = new Uint8Array(
    chunks.reduce(
      (acc: number[], chunk) => acc.concat(Array.from(chunk)),
      [] as number[],
    ),
  ).buffer;
  const length = arrayBuffer.byteLength;

  const storageService = new StorageService(env.ASSETS_BUCKET);
  await storageService.uploadObject(imageKey, arrayBuffer, {
    contentType: "image/png",
    contentLength: length,
  });

  const baseAssetsUrl = env.PUBLIC_ASSETS_URL || "";
  const message = {
    role: "assistant" as ChatRole,
    name: "podcast_generate_image",
    content: `Podcast Featured Image Uploaded: [${itemId}](${baseAssetsUrl}/${imageKey})`,
    data,
  };
  const response = await conversationManager.add(request.podcastId, message);

  return response;
};
