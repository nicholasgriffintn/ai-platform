import { recordModelTurnUsage, userCreditActor } from "@ngriffin_uk/polychat-ai-billing";
import type { SystemModelRole } from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-core";
import type z from "zod/v4";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { createUsageRuntime } from "~/modules/usage/application/runtime";

import { generateModelObject } from "./model-object";
import { runWithSystemModel, type SystemModelScope } from "./resolve";

export interface SystemObjectRequest<TObject> {
  role: SystemModelRole;
  scope?: SystemModelScope;
  name: string;
  requiresReasoning: boolean;
  schema: z.ZodType<TObject>;
  system: string;
  material: string;
}

export async function generateSystemObject<TObject>(
  context: ServiceContext,
  request: SystemObjectRequest<TObject>,
): Promise<TObject> {
  const user = context.requireUser();
  const runtime = createUsageRuntime({ env: context.env, repositories: context.repositories });

  return runWithSystemModel(
    context.env,
    user,
    request.role,
    async ({ model, provider, effort }) => {
      const { object, usage, rawUsage } = await generateModelObject({
        env: context.env,
        user,
        model,
        provider,
        reasoningEffort: request.requiresReasoning ? effort : "none",
        name: request.name,
        schema: request.schema,
        system: request.system,
        material: request.material,
      });

      await recordModelTurnUsage(runtime, {
        actor: userCreditActor(user.id),
        usage,
        rawUsage,
        model,
        provider,
        completionId: `${request.name}_${generateId()}`,
        runId: context.executionRunId ?? null,
        activityId: context.executionActivityId ?? null,
        runAttempt: context.executionRunAttempt ?? null,
      });

      return object;
    },
    request.scope,
  );
}
