import { AIProviderFactory } from "../../../providers/factory";
import type { IEnv } from "../../../types";

export interface SpeechGenerationParams {
  prompt: string;
  lang?: string;
}

export interface SpeechResponse {
  status: "success" | "error";
  name: string;
  content: string;
  data: any;
}

export async function generateSpeech({
  completion_id,
  app_url,
  env,
  args,
}: {
  completion_id: string;
  app_url: string | undefined;
  env: IEnv;
  args: SpeechGenerationParams;
}): Promise<SpeechResponse> {
  if (!args.prompt) {
    return {
      status: "error",
      name: "create_speech",
      content: "Missing prompt",
      data: {},
    };
  }

  try {
    const provider = AIProviderFactory.getProvider("workers-ai");

    const speechData = await provider.getResponse({
      completion_id,
      model: "@cf/myshell-ai/melotts",
      app_url,
      messages: [
        {
          role: "user",
          // @ts-ignore
          content: [
            {
              type: "text",
              text: args.prompt,
            },
          ],
        },
      ],
      lang: args.lang || "en",
      env: env,
    });

    return {
      status: "success",
      name: "create_speech",
      content: "Speech generated successfully",
      data: speechData,
    };
  } catch (error) {
    return {
      status: "error",
      name: "create_speech",
      content:
        error instanceof Error ? error.message : "Failed to generate speech",
      data: {},
    };
  }
}
