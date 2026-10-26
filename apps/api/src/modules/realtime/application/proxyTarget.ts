import type { RealtimeProvider } from "@ngriffin_uk/polychat-ai-providers";
import type { Context } from "hono";

import { ResponseFactory } from "~/infrastructure/http/ResponseFactory";
import type { IEnv, IUser } from "~/types";

export function resolveRealtimeProxyModel(
  context: Context,
  provider: RealtimeProvider,
  model?: string,
): string | Response {
  const modelToUse = model || provider.getDefaultModel("transcription");

  if (!provider.models?.includes(modelToUse)) {
    return ResponseFactory.error(
      context,
      `Invalid ${provider.descriptor.shortLabel} realtime model`,
      400,
    );
  }

  return modelToUse;
}

export async function resolveRealtimeProxyApiKey(
  context: Context,
  provider: RealtimeProvider,
  { env, user }: { env: IEnv; user: IUser },
): Promise<string | Response> {
  const apiKey = await provider.getApiKey?.({ env, user, type: "transcription" });

  if (!apiKey) {
    return ResponseFactory.error(
      context,
      `Failed to resolve API key for ${provider.descriptor.shortLabel} provider`,
      500,
    );
  }

  return apiKey;
}
