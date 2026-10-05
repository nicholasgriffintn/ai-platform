import {
  admitTurn,
  estimateTurnCreditMicros,
  isByokTurn,
  recordModelTurnUsage,
  userCreditActor,
} from "@ngriffin_uk/polychat-ai-billing";
import { normaliseTokenUsage } from "@ngriffin_uk/polychat-ai-telemetry";
import {
  creditMicrosFromCredits,
  memoryReflectionProposalSchema,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { redactSensitiveTokens } from "@ngriffin_uk/polychat-utility-server/redaction";

import { ai } from "~/infrastructure/ai";
import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { assertTurnAdmitted } from "~/modules/conversations/application/turn-admission";
import { findModelConfig, getAuxiliaryModel } from "~/modules/models/application/resolve";
import { createUsageRuntime } from "~/modules/usage/application/runtime";

import {
  MEMORY_REFLECTION_SYSTEM,
  MEMORY_REFLECTION_MAX_OUTPUT_TOKENS,
  memoryReflectionPrompt,
  memoryReflectionInputTokens,
  memoryReflectionContextLimit,
  memoryReflectionSourceTokenBudget,
} from "./reflection-prompt";
import type { MemoryReflectionSource } from "./reflection-proposal";

export async function prepareMemoryReflection(context: ServiceContext, base: string) {
  const user = context.requireUser();

  if (redactSensitiveTokens(base) !== base) {
    throw new AssistantError(
      "Remove recognised credentials from this memory before maintaining it",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  const { model, provider, effort } = await getAuxiliaryModel(context.env, user);
  const config = await findModelConfig(model, context.env, provider, user.id);

  if (!config) {
    throw new AssistantError(
      "The maintenance model is unavailable",
      ErrorType.CONFIGURATION_ERROR,
      400,
    );
  }

  return {
    memory: base,
    model,
    provider,
    effort,
    config,
    sourceTokenBudget: memoryReflectionSourceTokenBudget(base, config.contextWindow),
  };
}

export async function generateMemoryReflection(
  context: ServiceContext,
  prepared: Awaited<ReturnType<typeof prepareMemoryReflection>>,
  sources: readonly MemoryReflectionSource[],
  operationId: string,
  conversationId: string,
) {
  const user = context.requireUser();
  const { memory, model, provider, effort, config } = prepared;
  const prompt = memoryReflectionPrompt(memory, sources);
  const tokens = memoryReflectionInputTokens(memory, sources);

  if (
    tokens + MEMORY_REFLECTION_MAX_OUTPUT_TOKENS >
    memoryReflectionContextLimit(config.contextWindow)
  ) {
    throw new AssistantError(
      "Memory maintenance exceeds its context budget. Shorten the memory or source message before retrying.",
      ErrorType.CONTEXT_WINDOW_EXCEEDED,
      400,
    );
  }

  const estimatedCreditMicros = estimateTurnCreditMicros({
    promptTokens: tokens,
    modelConfig: config,
    outputAllowanceTokens: MEMORY_REFLECTION_MAX_OUTPUT_TOKENS,
  });

  if (estimatedCreditMicros > creditMicrosFromCredits(5)) {
    throw new AssistantError(
      "Memory maintenance exceeds its five-credit budget",
      ErrorType.USAGE_LIMIT_ERROR,
      400,
    );
  }

  const runtime = createUsageRuntime({ env: context.env, repositories: context.repositories });
  const admission = (await isByokTurn(runtime.store, user.id, provider))
    ? null
    : await admitTurn(runtime, {
        actor: userCreditActor(user.id),
        planId: user.plan_id ?? null,
        estimatedCreditMicros,
      });

  if (admission) {
    assertTurnAdmitted(admission);
  }

  try {
    const result = await ai.generateObject(
      {
        env: context.env,
        user,
        model,
        provider,
        reasoning_effort: effort,
        system: MEMORY_REFLECTION_SYSTEM,
        prompt,
        max_tokens: MEMORY_REFLECTION_MAX_OUTPUT_TOKENS,
        disable_functions: true,
        store: false,
        schema: memoryReflectionProposalSchema,
        name: "memory_reflection",
      },
      async (completion) => {
        await recordModelTurnUsage(runtime, {
          actor: userCreditActor(user.id),
          usage: normaliseTokenUsage(completion.usage),
          rawUsage: completion.usage,
          model: completion.model,
          provider: completion.provider,
          completionId: conversationId,
          conversationId,
          messageId: operationId,
        });
      },
    );

    return result.object;
  } finally {
    if (admission?.admitted) {
      await admission.reservation?.release();
    }
  }
}
