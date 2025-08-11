import { sanitiseInput } from "~/lib/chat/utils";
import { AIProviderFactory } from "~/lib/providers/factory";
import { getModelConfigByMatchingModel } from "~/lib/models";
import type { IEnv, IUser } from "~/types";
import type { Message, MessageContent } from "~/types/chat";

export interface VideoGenerationParams {
  prompt: string;
  negative_prompt?: string;
  guidance_scale?: number;
  video_length?: number;
  height?: number;
  width?: number;
  model?: string;
}

export interface VideoResponse {
  status: "success" | "error";
  name: string;
  content: string;
  data: any;
}

const REPLICATE_MODEL_VERSION =
  "847dfa8b01e739637fc76f480ede0c1d76408e1d694b830b5dfb8e547bf98405";

export async function generateVideo({
  completion_id,
  app_url,
  env,
  args,
  user,
}: {
  completion_id: string;
  app_url: string | undefined;
  env: IEnv;
  args: VideoGenerationParams;
  user: IUser;
}): Promise<VideoResponse> {
  try {
    if (!args.prompt) {
      return {
        status: "error",
        name: "create_video",
        content: "Missing prompt",
        data: {},
      };
    }

    const sanitisedPrompt = sanitiseInput(args.prompt);

    const requestedModel = args.model || REPLICATE_MODEL_VERSION;
    const modelConfig = await getModelConfigByMatchingModel(requestedModel, env);
    const providerKey = modelConfig?.provider || "replicate";

    const provider = AIProviderFactory.getProvider(providerKey);

    let messages: Message[];
    if (providerKey === "bedrock") {
      const contentParts: MessageContent[] = [
        { type: "text", text: sanitisedPrompt },
      ];
      messages = [
        {
          role: "user",
          content: contentParts,
        },
      ];
    } else {
      messages = [
        {
          role: "user",
          // @ts-ignore replicate expects raw object content as last message
          content: {
            ...args,
            // @ts-ignore
            prompt: sanitisedPrompt,
          },
        },
      ];
    }

    const videoData = await provider.getResponse({
      completion_id,
      app_url,
      model: requestedModel,
      messages,
      env: env,
      user: user,
      // Bedrock Nova Reel is async-only and does not support streaming; Replicate polling handled by should_poll
      stream: false,
      should_poll: providerKey === "replicate",
    });

    return {
      status: "success",
      name: "create_video",
      content: "Video generated successfully",
      data: videoData,
    };
  } catch (error) {
    return {
      status: "error",
      name: "create_video",
      content:
        error instanceof Error ? error.message : "Failed to generate video",
      data: {},
    };
  }
}
