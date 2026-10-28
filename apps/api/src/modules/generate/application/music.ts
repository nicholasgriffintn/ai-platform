import { hasProEntitlement } from "@ngriffin_uk/polychat-library-policy";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { sanitiseInput } from "@ngriffin_uk/polychat-utility-server/sanitise";

import { ai } from "~/infrastructure/ai";
import {
  resolveServiceContext,
  type ServiceContext,
} from "~/infrastructure/context/serviceContext";
import { hasUserProviderApiKey } from "~/infrastructure/providers/credentials";
import { requireSystemModel } from "~/modules/models/application/resolve";
import type { IEnv, IUser } from "~/types";

export interface MusicGenerationParams {
  prompt: string;
  input_audio?: string;
  duration?: number;
  provider?: string;
  model?: string;
}

export interface MusicResponse {
  status: "success" | "error";
  name: string;
  content: string;
  data: any;
}

export async function generateMusic({
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
  args: MusicGenerationParams;
  user: IUser;
}): Promise<MusicResponse> {
  try {
    const serviceContext = resolveServiceContext({ context, env, user });
    const runtimeEnv = serviceContext.env;
    const runtimeUser = serviceContext.user ?? user;

    if (!args.prompt) {
      return {
        status: "error",
        name: "create_music",
        content: "Missing prompt",
        data: {},
      };
    }

    const sanitisedPrompt = sanitiseInput(args.prompt).trim();

    if (!sanitisedPrompt) {
      return {
        status: "error",
        name: "create_music",
        content: "Missing prompt",
        data: {},
      };
    }

    const selected = args.model
      ? { id: args.model, provider: args.provider }
      : await requireSystemModel(runtimeEnv, runtimeUser, "music");
    const { providerName } = await ai.resolveMediaProvider(
      { env: runtimeEnv, model: selected.id },
      { provider: selected.provider },
    );

    if (
      !hasProEntitlement(runtimeUser) &&
      !(await hasUserProviderApiKey({
        env: runtimeEnv,
        user: runtimeUser,
        providerName,
      }))
    ) {
      throw new AssistantError(
        `Music generation requires a configured ${providerName} provider key`,
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
      inputAudio: args.input_audio,
      duration: args.duration,
      model: selected.id,
    };

    const musicData = await ai.music(request, {
      provider: providerName,
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
      content: error instanceof Error ? error.message : "Failed to generate music",
      data: {},
    };
  }
}
