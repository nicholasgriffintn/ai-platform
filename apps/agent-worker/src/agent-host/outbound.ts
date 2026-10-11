import {
  containerEgressBlockedResponse,
  decideContainerEgress,
  parseContainerEgressPolicy,
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

function polychatCompletionRequest(body: Record<string, unknown>, modelTier: ModelTier) {
  const request = { ...body };

  delete request.model;

  return {
    ...request,
    model_tier: modelTier,
    store: false,
    enabled_tools: [],
  };
}

async function polychatRequestBody(request: Request, modelTier: ModelTier): Promise<string> {
  const body = await request.text();

  try {
    const parsedBody: unknown = JSON.parse(body);

    return isRecord(parsedBody)
      ? JSON.stringify(polychatCompletionRequest(parsedBody, modelTier))
      : body;
  } catch {
    return body;
  }
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

  const response = await env.POLYCHAT_API.fetch(
    new Request("http://polychat-api/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "Polychat-Agent-Host/1.0 (+https://polychat.app)",
      },
      body: await polychatRequestBody(request, params.modelTier),
      signal: request.signal,
    }),
  );

  return response;
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
