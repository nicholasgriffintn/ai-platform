import { AIProviderFactory } from "../../../providers/factory";
import type { IEnv, IUser } from "../../../types";

export interface MusicGenerationParams {
  prompt: string;
  input_audio?: string;
  duration?: number;
}

export interface MusicResponse {
  status: "success" | "error";
  name: string;
  content: string;
  data: any;
}

const REPLICATE_MODEL_VERSION =
  "671ac645ce5e552cc63a54a2bbff63fcf798043055d2dac5fc9e36a837eedcfb";

export async function generateMusic({
  completion_id,
  app_url,
  env,
  args,
  user,
}: {
  completion_id: string;
  app_url: string | undefined;
  env: IEnv;
  args: MusicGenerationParams;
  user: IUser;
}): Promise<MusicResponse> {
  try {
    if (!args.prompt) {
      return {
        status: "error",
        name: "create_music",
        content: "Missing prompt",
        data: {},
      };
    }

    const provider = AIProviderFactory.getProvider("replicate");

    const musicData = await provider.getResponse({
      completion_id,
      app_url,
      model: REPLICATE_MODEL_VERSION,
      messages: [
        {
          role: "user",
          // @ts-ignore
          content: {
            ...args,
          },
        },
      ],
      env: env,
      user: user,
    });

    return {
      status: "success",
      name: "create_music",
      content: "Music generated successfully",
      data: musicData,
    };
  } catch (error) {
    return {
      status: "error",
      name: "create_music",
      content:
        error instanceof Error ? error.message : "Failed to generate music",
      data: {},
    };
  }
}
