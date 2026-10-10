import {
  containerEgressBlockedResponse,
  decideContainerEgress,
  parseContainerEgressPolicy,
  toOpenAICompletion,
  toOpenAICompletionStream,
  toPolychatCompletionRequest,
} from "@ngriffin_uk/polychat-library-sandbox";
import { modelTierSchema, type ModelTier } from "@ngriffin_uk/polychat-schemas";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";

import { POLYCHAT_MODEL_NAME } from "../config/agent-host";
import type { Env } from "../types";

interface OutboundContext {
  containerId: string;
  params?: unknown;
}

export interface PolychatModelParams {
  apiKey: string;
  modelTier: ModelTier;
}

function parsePolychatModelParams(value: unknown): PolychatModelParams | null {
  if (!isRecord(value) || typeof value.apiKey !== "string" || !value.apiKey.startsWith("ak_")) {
    return null;
  }

  const modelTier = modelTierSchema.safeParse(value.modelTier);

  return modelTier.success ? { apiKey: value.apiKey, modelTier: modelTier.data } : null;
}

function openAIError(status: number, message: string): Response {
  return Response.json({ error: { message, type: "polychat_gateway_error" } }, { status });
}

export async function polychatModelsOutbound(
  request: Request,
  env: Env,
  ctx: OutboundContext,
): Promise<Response> {
  const url = new URL(request.url);

  if (request.method === "GET" && url.pathname.endsWith("/models")) {
    return Response.json({
      object: "list",
      data: [{ id: POLYCHAT_MODEL_NAME, object: "model", owned_by: "polychat" }],
    });
  }

  if (request.method !== "POST" || url.pathname !== "/v1/chat/completions") {
    return openAIError(404, "Only chat completions are available");
  }

  const params = parsePolychatModelParams(ctx.params);

  if (!params) {
    return openAIError(503, "This agent host has no model access");
  }

  const body: unknown = await request.json().catch(() => null);

  if (!isRecord(body)) {
    return openAIError(400, "Request body must be a JSON object");
  }

  const bridged = toPolychatCompletionRequest(body, params.modelTier);
  const response = await env.POLYCHAT_API.fetch(
    new Request("http://polychat-api/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "Polychat-Agent-Host/1.0 (+https://polychat.app)",
      },
      body: JSON.stringify(bridged.body),
    }),
  );

  if (!response.ok) {
    return openAIError(response.status, `Polychat returned ${response.status}`);
  }

  const completion = toOpenAICompletion(await response.json(), POLYCHAT_MODEL_NAME);

  if (!completion) {
    return openAIError(502, "Polychat returned an unreadable completion");
  }

  return bridged.stream
    ? new Response(toOpenAICompletionStream(completion), {
        headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store" },
      })
    : Response.json(completion);
}

export async function agentHostEgressOutbound(
  request: Request,
  _env: Env,
  ctx: OutboundContext,
): Promise<Response> {
  const policy = parseContainerEgressPolicy(ctx.params);
  const decision = policy
    ? decideContainerEgress(policy, { url: new URL(request.url), method: request.method })
    : { kind: "block" as const, reason: "the agent host has no network policy" };

  return decision.kind === "allow"
    ? fetch(request)
    : containerEgressBlockedResponse(
        decision.reason,
        "Hosted agents can read package registries and reach Polychat models only.",
      );
}
