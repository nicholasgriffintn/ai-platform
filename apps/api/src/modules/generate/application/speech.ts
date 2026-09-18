import { MODEL_DEFAULTS } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { sanitiseInput } from "@ngriffin_uk/polychat-utility-server/sanitise";

import { ai } from "~/infrastructure/ai";
import {
  resolveServiceContext,
  type ServiceContext,
} from "~/infrastructure/context/serviceContext";
import { hasUserProviderApiKey } from "~/infrastructure/providers/credentials";
import type { IEnv, IUser } from "~/types";

export interface SpeechGenerationParams {
  prompt: string;
  lang?: string;
  provider?: string;
  model?: string;
  voice?: string;
}

export interface SpeechResponse {
  status: "success" | "error";
  name: string;
  content: string;
  data: any;
}

const DEFAULT_PROVIDER = MODEL_DEFAULTS.speech.workersAi.provider;

export async function generateSpeech({
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
  args: SpeechGenerationParams;
  user: IUser;
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
    const serviceContext = resolveServiceContext({ context, env, user });
    const runtimeEnv = serviceContext.env;
    const runtimeUser = serviceContext.user ?? user;

    const sanitisedPrompt = sanitiseInput(args.prompt);

    const { providerName } = await ai.resolveMediaProvider(
      "speech",
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
        `Speech generation requires a configured ${providerName} provider key`,
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
      locale: args.lang || "en",
      voice: args.voice,
      model: args.model,
    };

    const speechData = await ai.speech(request, {
      provider: providerName,
      defaultProvider: DEFAULT_PROVIDER,
      allowFallback: runtimeUser.plan_id === "pro",
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
      content: error instanceof Error ? error.message : "Failed to generate speech",
      data: {},
    };
  }
}
