import { recordModelTurnUsage, userCreditActor } from "@ngriffin_uk/polychat-ai-billing";
import { normaliseTokenUsage } from "@ngriffin_uk/polychat-ai-telemetry";
import type { ModelTier } from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-core";
import type z from "zod/v4";

import { ai } from "~/infrastructure/ai";
import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { createUsageRuntime } from "~/modules/usage/application/runtime";

import { getTierModel } from "./resolve";

export interface TierObjectRequest<TObject> {
  tier: ModelTier;
  name: string;
  schema: z.ZodType<TObject>;
  system: string;
  material: string;
}

export async function generateTierObject<TObject>(
  context: ServiceContext,
  request: TierObjectRequest<TObject>,
): Promise<TObject> {
  const user = context.requireUser();
  const { model, provider, effort } = await getTierModel(context.env, user, request.tier);
  const runtime = createUsageRuntime({ env: context.env, repositories: context.repositories });
  const { object } = await ai.generateObject(
    {
      env: context.env,
      user,
      model,
      provider,
      reasoning_effort: effort,
      disable_functions: true,
      name: request.name,
      schema: request.schema,
      system: request.system,
      prompt: request.material,
    },
    async (completion) => {
      await recordModelTurnUsage(runtime, {
        actor: userCreditActor(user.id),
        usage: normaliseTokenUsage(completion.usage),
        rawUsage: completion.usage,
        model: completion.model,
        provider: completion.provider,
        completionId: `${request.name}_${generateId()}`,
        runId: context.executionRunId ?? null,
        runAttempt: context.executionRunAttempt ?? null,
      });
    },
  );

  return object;
}
