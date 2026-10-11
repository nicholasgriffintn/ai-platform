import {
  containerEgressBlockedResponse,
  decideContainerEgress,
  parseContainerEgressPolicy,
} from "@ngriffin_uk/polychat-library-sandbox";
import {
  modelTierSchema,
  partialChatCompletionsJsonSchema,
  type ModelTier,
} from "@ngriffin_uk/polychat-schemas";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";

import { POLYCHAT_MODEL_NAME } from "../config/agent-host";
import type { Env } from "../types";

interface OutboundContext {
  containerId: string;
  params?: unknown;
}

const polychatModelRequestSchema = partialChatCompletionsJsonSchema
  .pick({
    messages: true,
    stream: true,
    tools: true,
    tool_choice: true,
    parallel_tool_calls: true,
    response_format: true,
    temperature: true,
    top_p: true,
    top_k: true,
    stop: true,
    max_tokens: true,
    max_completion_tokens: true,
    max_output_tokens: true,
    presence_penalty: true,
    frequency_penalty: true,
    repetition_penalty: true,
    logit_bias: true,
    logprobs: true,
    top_logprobs: true,
    seed: true,
    reasoning_effort: true,
    reasoning: true,
    verbosity: true,
    system_prompt: true,
    service_tier: true,
    stream_options: true,
    safety_identifier: true,
  })
  .strip();

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

function polychatCompletionRequest(
  body: ReturnType<typeof polychatModelRequestSchema.parse>,
  modelTier: ModelTier,
): Record<string, unknown> {
  return {
    ...body,
    model_tier: modelTier,
    stream: body.stream === true,
    store: false,
    enabled_tools: [],
  };
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
  const completionRequest = polychatModelRequestSchema.safeParse(body);

  if (!completionRequest.success || !completionRequest.data.messages?.length) {
    return openAIError(400, "Invalid chat completion request");
  }

  const response = await env.POLYCHAT_API.fetch(
    new Request("http://polychat-api/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "Polychat-Agent-Host/1.0 (+https://polychat.app)",
      },
      body: JSON.stringify(polychatCompletionRequest(completionRequest.data, params.modelTier)),
      signal: request.signal,
    }),
  );

  if (!response.ok) {
    return openAIError(response.status, `Polychat returned ${response.status}`);
  }

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
