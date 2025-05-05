import { sanitiseInput } from "~/lib/chat/utils";
import { AIProviderFactory } from "~/providers/factory";
import type { IEnv, IUser } from "~/types";

export interface VideoGenerationParams {
  prompt: string;
  negative_prompt?: string;
  guidance_scale?: number;
  video_length?: number;
  height?: number;
  width?: number;
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

    const provider = AIProviderFactory.getProvider("replicate");

    const videoData = await provider.getResponse({
      completion_id,
      app_url,
      model: REPLICATE_MODEL_VERSION,
      messages: [
        {
          role: "user",
          // @ts-ignore
          content: {
            ...args,
            // @ts-ignore
            prompt: sanitisedPrompt,
          },
        },
      ],
      env: env,
      user: user,
      should_poll: true,
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
