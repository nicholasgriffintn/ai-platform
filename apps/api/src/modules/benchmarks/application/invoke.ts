import { recordModelTurnUsage, userCreditActor } from "@ngriffin_uk/polychat-ai-billing";
import { extractUsagePayload, normaliseTokenUsage } from "@ngriffin_uk/polychat-ai-telemetry";
import type { Benchmark } from "@ngriffin_uk/polychat-library-benchmarks";
import { estimateUsageCost } from "@ngriffin_uk/polychat-library-chat/response-stats";
import {
  hasProviderReasoningOptions,
  readDecisionNoul,
  type BenchmarkId,
} from "@ngriffin_uk/polychat-schemas";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";

import { ai } from "~/infrastructure/ai";
import { createServiceContext } from "~/infrastructure/context/serviceContext";
import type { RepositoryManager } from "~/infrastructure/database/repositoryManager";
import {
  getAIResponseForTarget,
  type AuthorisedModelTarget,
} from "~/modules/chat/application/streaming/responses";
import { completeWorkspaceRoute } from "~/modules/model-serving/application/route-completion";
import { createUsageRuntime } from "~/modules/usage/application/runtime";
import type { IEnv, IUser, Message } from "~/types";

import type { EntrantTarget } from "./entrants";
import { loadBenchmarkPhotoDataUrl } from "./photos";

export const BENCHMARK_MAX_OUTPUT_TOKENS = 16_384;
export const BENCHMARK_REASONING_EFFORT = "medium";

export interface EntrantResponse {
  output: string;
  answer: unknown;
  inputTokens: number;
  outputTokens: number;
  costUsd: number | null;
  latencyMs: number;
}

interface InvocationScope {
  env: IEnv;
  repositories: RepositoryManager;
  user: IUser | null;
  runId: string;
  benchmarkId: BenchmarkId;
  benchmark: Benchmark;
  itemId: string;
}

function readText(response: unknown): string {
  if (typeof response === "string") {
    return response;
  }

  if (!isRecord(response)) {
    return "";
  }

  return typeof response.response === "string"
    ? response.response
    : JSON.stringify(response.response ?? "");
}

async function buildMessages(scope: InvocationScope): Promise<Message[]> {
  const prompt = scope.benchmark.prompt(scope.itemId);
  const image = prompt.imageItemId
    ? await loadBenchmarkPhotoDataUrl(scope.env, scope.benchmarkId, prompt.imageItemId)
    : null;

  return [
    {
      role: "user",
      content: image
        ? [
            { type: "text", text: prompt.user },
            { type: "image_url", image_url: { url: image, detail: "high" } },
          ]
        : prompt.user,
    },
  ];
}

async function invokeChatModel(
  scope: InvocationScope,
  model: AuthorisedModelTarget,
): Promise<EntrantResponse> {
  const context = createServiceContext({ env: scope.env, user: scope.user });
  const started = Date.now();
  const response = await getAIResponseForTarget(
    {
      env: scope.env,
      model: model.config.id ?? model.config.matchingModel,
      provider: model.config.provider,
      system_prompt: scope.benchmark.prompt(scope.itemId).system,
      messages: await buildMessages(scope),
      max_tokens: BENCHMARK_MAX_OUTPUT_TOKENS,
      reasoning_effort: hasProviderReasoningOptions(model.config)
        ? BENCHMARK_REASONING_EFFORT
        : undefined,
      disable_functions: true,
      stream: false,
      store: false,
      context,
    },
    model,
  );
  const latencyMs = Date.now() - started;
  const rawUsage = extractUsagePayload(response);
  const usage = normaliseTokenUsage(rawUsage);
  const inputTokens = usage?.input_tokens ?? 0;
  const outputTokens = usage?.output_tokens ?? 0;
  const output = readText(response);

  if (scope.user) {
    await recordModelTurnUsage(
      createUsageRuntime({ env: scope.env, repositories: scope.repositories }),
      {
        actor: userCreditActor(scope.user.id),
        usage,
        rawUsage,
        model: model.config.id ?? model.config.matchingModel,
        provider: model.config.provider,
        completionId: `benchmark:${scope.runId}`,
        messageId: `benchmark:${scope.runId}:${scope.itemId}`,
        conversationId: `benchmark:${scope.runId}`,
        runId: null,
        runAttempt: null,
      },
    );
  }

  return {
    output,
    answer: scope.benchmark.parseOutput(output),
    inputTokens,
    outputTokens,
    costUsd:
      model.credentialAuthority === "byok"
        ? null
        : (estimateUsageCost({ inputTokens, outputTokens }, model.config) ?? null),
    latencyMs,
  };
}

async function invokeDecisionModel(
  scope: InvocationScope,
  model: AuthorisedModelTarget,
): Promise<EntrantResponse> {
  const decision = scope.benchmark.decision(scope.itemId);

  if (!decision) {
    return {
      output: "",
      answer: null,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: null,
      latencyMs: 0,
    };
  }

  const started = Date.now();
  const result = await ai.decide({
    env: scope.env,
    user: scope.user ?? undefined,
    model: model.config.matchingModel,
    provider: model.config.provider,
    state: decision.state,
    questions: decision.questions,
  });
  const probability = readDecisionNoul(result.answers, decision.answerKey);

  return {
    output: JSON.stringify({ probability }),
    answer: scope.benchmark.fromDecision(probability),
    inputTokens: 0,
    outputTokens: 0,
    costUsd: null,
    latencyMs: Date.now() - started,
  };
}

async function invokeRoute(
  scope: InvocationScope,
  route: Extract<EntrantTarget, { kind: "route" }>["route"],
): Promise<EntrantResponse> {
  const prompt = scope.benchmark.prompt(scope.itemId);
  const started = Date.now();
  const output = await completeWorkspaceRoute(
    scope.env,
    scope.repositories,
    route,
    prompt.user,
    prompt.system,
  );

  return {
    output,
    answer: scope.benchmark.parseOutput(output),
    inputTokens: 0,
    outputTokens: 0,
    costUsd: null,
    latencyMs: Date.now() - started,
  };
}

export async function invokeEntrant(
  scope: InvocationScope,
  target: EntrantTarget,
): Promise<EntrantResponse> {
  if (target.kind === "route") {
    return invokeRoute(scope, target.route);
  }

  return target.kind === "decision"
    ? invokeDecisionModel(scope, target.model)
    : invokeChatModel(scope, target.model);
}
