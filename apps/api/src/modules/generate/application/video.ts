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

export interface VideoGenerationParams {
  prompt: string;
  negative_prompt?: string;
  guidance_scale?: number;
  video_length?: number;
  duration?: number;
  height?: number;
  width?: number;
  provider?: string;
  model?: string;
  aspect_ratio?: string;
}

export interface VideoResponse {
  status: "success" | "error";
  name: string;
  content: string;
  data: any;
}

export async function generateVideo({
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
  args: VideoGenerationParams;
  user: IUser;
}): Promise<VideoResponse> {
  try {
    const serviceContext = resolveServiceContext({ context, env, user });
    const runtimeEnv = serviceContext.env;
    const runtimeUser = serviceContext.user ?? user;

    if (!args.prompt) {
      return {
        status: "error",
        name: "create_video",
        content: "Missing prompt",
        data: {},
      };
    }

    const sanitisedPrompt = sanitiseInput(args.prompt).trim();

    if (!sanitisedPrompt) {
      return {
        status: "error",
        name: "create_video",
        content: "Missing prompt",
        data: {},
      };
    }

    const selected = args.model
      ? { id: args.model, provider: args.provider }
      : await requireSystemModel(runtimeEnv, runtimeUser, "video");
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
        `Video generation requires a configured ${providerName} provider key`,
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
      negativePrompt: args.negative_prompt,
      guidanceScale: args.guidance_scale,
      videoLength: args.video_length,
      duration: args.duration,
      height: args.height,
      width: args.width,
      aspectRatio: args.aspect_ratio,
      model: selected.id,
    };

    const videoData = await ai.video(request, {
      provider: providerName,
    });

    const isAsync = videoData?.status === "in_progress";

    return {
      status: "success",
      name: "create_video",
      content: isAsync ? "Video generation in progress" : "Video generated successfully",
      data: videoData,
    };
  } catch (error) {
    return {
      status: "error",
      name: "create_video",
      content: error instanceof Error ? error.message : "Failed to generate video",
      data: {},
    };
  }
}
