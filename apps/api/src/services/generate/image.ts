import type { imagePrompts } from "@ngriffin_uk/polychat-ai-providers";
import { MODEL_DEFAULTS } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { sanitiseInput } from "@ngriffin_uk/polychat-utility-server/sanitise";

import { ai } from "~/lib/ai";
import { resolveServiceContext, type ServiceContext } from "~/lib/context/serviceContext";
import { hasUserProviderApiKey } from "~/lib/providers/credentials";
import type { IEnv, IUser } from "~/types";

export interface ImageGenerationParams {
  prompt: string;
  image_style?: keyof typeof imagePrompts;
  steps?: number;
  provider?: string;
  model?: string;
  aspect_ratio?: string;
  width?: number;
  height?: number;
}

export interface ImageResponse {
  status: "success" | "error";
  name: string;
  content: string;
  data: any;
}

const DEFAULT_PROVIDER = MODEL_DEFAULTS.image.workersAi.provider;

export async function generateImage({
  completion_id,
  app_url,
  env,
  context,
  args,
  user,
}: {
  completion_id: string;
  app_url: string | undefined;
  env?: IEnv;
  context?: ServiceContext;
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
    const serviceContext = resolveServiceContext({ context, env, user });
    const runtimeEnv = serviceContext.env;
    const runtimeUser = serviceContext.user ?? user;

    const sanitisedPrompt = sanitiseInput(args.prompt);

    const diffusionSteps = args.steps === undefined || args.steps === 0 ? 4 : args.steps;

    if (diffusionSteps < 1 || diffusionSteps > 8) {
      return {
        status: "error",
        name: "create_image",
        content: "Invalid number of diffusion steps",
        data: {},
      };
    }

    const { providerName } = await ai.resolveMediaProvider(
      "image",
      { env: runtimeEnv, model: args.model },
      { provider: args.provider, defaultProvider: DEFAULT_PROVIDER },
    );

    if (
      runtimeUser.plan_id !== "pro" &&
      !(await hasUserProviderApiKey({
        env: runtimeEnv,
        user: runtimeUser,
        providerName,
      }))
    ) {
      throw new AssistantError(
        `Image generation requires a configured ${providerName} provider key`,
        ErrorType.AUTHORISATION_ERROR,
        403,
      );
    }

    const request = {
      prompt: sanitisedPrompt,
      env: runtimeEnv,
      user: runtimeUser,
      completion_id,
      app_url,
      style: args.image_style,
      aspectRatio: args.aspect_ratio,
      width: args.width,
      height: args.height,
      steps: diffusionSteps,
      model: args.model,
      metadata: {
        steps: diffusionSteps,
      },
    };

    const imageData = await ai.image(request, {
      provider: providerName,
      defaultProvider: DEFAULT_PROVIDER,
      allowFallback: runtimeUser.plan_id === "pro",
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
      content: error instanceof Error ? error.message : "Failed to generate image",
      data: {},
    };
  }
}
