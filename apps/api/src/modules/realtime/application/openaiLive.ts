import {
  buildOpenAILiveSessionConfig,
  OPENAI_LIVE_SESSIONS_URL,
} from "@ngriffin_uk/polychat-ai-providers";
import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { NO_STORE } from "@ngriffin_uk/polychat-schemas";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";
import { sha256Hex } from "@ngriffin_uk/polychat-utility-server/crypto";
import type { Context } from "hono";

import { ResponseFactory } from "~/infrastructure/http/ResponseFactory";
import { getRealtimeProvider } from "~/infrastructure/providers/capabilities/realtime";
import { getSystemModel } from "~/modules/models/application/resolve";
import type { IEnv, IUser } from "~/types";

const logger = getLogger({ prefix: "services/realtime/openai-live" });
const SDP_CONTENT_TYPE = "application/sdp";

function getLiveFailureStatus(providerStatus: number): 400 | 401 | 403 | 429 | 502 {
  switch (providerStatus) {
    case 400:
    case 401:
    case 403:
    case 429:
      return providerStatus;
    default:
      return 502;
  }
}

export function buildOpenAILiveCallBody({
  model,
  instructions,
  voice,
  delegationModel,
  offer,
}: {
  model: string;
  instructions?: string;
  voice?: string;
  delegationModel?: string;
  offer: string;
}): Record<string, unknown> {
  return {
    session: buildOpenAILiveSessionConfig({ model, instructions, voice, delegationModel }),
    transport: { type: "webrtc", sdp: offer },
  };
}

export function readOpenAILiveAnswer(payload: unknown): string | undefined {
  if (!isRecord(payload)) {
    return undefined;
  }

  const transport = payload.transport;

  if (!isRecord(transport) || typeof transport.sdp !== "string" || !transport.sdp.trim()) {
    return undefined;
  }

  return transport.sdp;
}

export async function createOpenAILiveCallResponse({
  context,
  env,
  user,
  model,
  instructions,
  voice,
}: {
  context: Context;
  env: IEnv;
  user: IUser;
  model: string;
  instructions?: string;
  voice?: string;
}): Promise<Response> {
  const offer = (await context.req.text()).trim();

  if (!offer) {
    return ResponseFactory.error(context, "Missing WebRTC offer", 400);
  }

  const provider = getRealtimeProvider("openai", { env, user });

  if (!provider.models?.includes(model)) {
    return ResponseFactory.error(context, "Invalid model specified", 400);
  }

  const apiKey = await provider.getApiKey?.({ env, user, type: "realtime" });
  const delegationModel = (await getSystemModel(env, user, "liveDelegation"))?.model;

  if (!apiKey) {
    return ResponseFactory.error(context, "Failed to resolve API key for OpenAI provider", 500);
  }

  const upstreamResponse = await fetch(OPENAI_LIVE_SESSIONS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "OpenAI-Safety-Identifier": await sha256Hex(`user:${user.id}`),
    },
    body: JSON.stringify(
      buildOpenAILiveCallBody({ model, instructions, voice, delegationModel, offer }),
    ),
  });

  if (!upstreamResponse.ok) {
    logger.error("GPT-Live session creation failed", {
      providerStatus: upstreamResponse.status,
      providerStatusText: upstreamResponse.statusText,
    });

    return ResponseFactory.error(
      context,
      "GPT-Live session failed",
      getLiveFailureStatus(upstreamResponse.status),
    );
  }

  const answer = readOpenAILiveAnswer(await upstreamResponse.json().catch(() => undefined));

  if (!answer) {
    logger.error("GPT-Live session answer missing");

    return ResponseFactory.error(context, "GPT-Live session failed", 502);
  }

  return new Response(answer, {
    status: 201,
    headers: {
      "Content-Type": SDP_CONTENT_TYPE,
      "Cache-Control": NO_STORE,
    },
  });
}
