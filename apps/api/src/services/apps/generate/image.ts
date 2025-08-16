import { sanitiseInput } from "~/lib/chat/utils";
import {
  getTextToImageSystemPrompt,
  type imagePrompts,
} from "~/lib/prompts/image";
import { AIProviderFactory } from "~/lib/providers/factory";
import { getModelConfigByMatchingModel } from "~/lib/models";
import type { IEnv, IUser } from "~/types";
import type { Message, MessageContent } from "~/types/chat";

export interface ImageGenerationParams {
  prompt: string;
  image_style: keyof typeof imagePrompts;
  steps: number;
  model?: string;
}

export interface ImageResponse {
  status: "success" | "error";
  name: string;
  content: string;
  data: any;
}

export async function generateImage({
  completion_id,
  app_url,
  env,
  args,
  user,
}: {
  completion_id: string;
  app_url: string | undefined;
  env: IEnv;
  args: ImageGenerationParams;
  user: IUser;
}): Promise<ImageResponse> {
  if (!args.prompt) {
    return {
      status: "error",
      name: "create_image",
      content: "Missing prompt",
      data: {},
    };
  }

  try {
    const requestedModel = args.model || "@cf/black-forest-labs/flux-1-schnell";
    const modelConfig = await getModelConfigByMatchingModel(requestedModel, env);

    const providerKey = modelConfig?.provider || "workers";
    const provider = AIProviderFactory.getProvider(providerKey);

    const sanitisedPrompt = sanitiseInput(args.prompt);

    const systemPrompt = getTextToImageSystemPrompt(args.image_style);
    const diffusionSteps = args.steps || 4;

    if (diffusionSteps < 1 || diffusionSteps > 8) {
      return {
        status: "error",
        name: "create_image",
        content: "Invalid number of diffusion steps",
        data: {},
      };
    }

    const contentParts: MessageContent[] = [
      { type: "text", text: `${systemPrompt}\n\n${sanitisedPrompt}` },
    ];

    const messages: Message[] = [
      {
        role: "user",
        content: contentParts,
      },
    ];

    const imageData = await provider.getResponse({
      completion_id,
      model: requestedModel,
      app_url,
      messages,
      env: env,
      user: user,
      stream: false,
    });

    return {
      status: "success",
      name: "create_image",
      content: "Image generated successfully",
      data: imageData,
    };
  } catch (error) {
    return {
      status: "error",
      name: "create_image",
      content:
        error instanceof Error ? error.message : "Failed to generate image",
      data: {},
    };
  }
}
