import { recordModelTurnUsage, userCreditActor } from "@ngriffin_uk/polychat-ai-billing";
import { normaliseTokenUsage } from "@ngriffin_uk/polychat-ai-telemetry";
import { generateId } from "@ngriffin_uk/polychat-utility-core";
import type z from "zod/v4";

import { ai } from "~/infrastructure/ai";
import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { getTierModel } from "~/modules/models/application/resolve";
import { createUsageRuntime } from "~/modules/usage/application/runtime";

const DISCOVER_MODEL_TIER = "medium";

export async function generateDiscoverObject<TObject>(
  context: ServiceContext,
  params: { name: string; schema: z.ZodType<TObject>; system: string; material: string },
): Promise<TObject> {
  const user = context.requireUser();
  const { model, provider, effort } = await getTierModel(context.env, user, DISCOVER_MODEL_TIER);
  const runtime = createUsageRuntime({ env: context.env, repositories: context.repositories });
  const { object } = await ai.generateObject(
    {
      env: context.env,
      user,
      model,
      provider,
      reasoning_effort: effort,
      disable_functions: true,
      name: params.name,
      schema: params.schema,
      system: params.system,
      prompt: params.material,
    },
    async (completion) => {
      await recordModelTurnUsage(runtime, {
        actor: userCreditActor(user.id),
        usage: normaliseTokenUsage(completion.usage),
        rawUsage: completion.usage,
        model: completion.model,
        provider: completion.provider,
        completionId: `discover_${generateId()}`,
        runId: context.executionRunId ?? null,
        runAttempt: context.executionRunAttempt ?? null,
      });
    },
  );

  return object;
}
