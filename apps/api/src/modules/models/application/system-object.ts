import { recordModelTurnUsage, userCreditActor } from "@ngriffin_uk/polychat-ai-billing";
import { normaliseTokenUsage } from "@ngriffin_uk/polychat-ai-telemetry";
import type { SystemModelRole } from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-core";
import type z from "zod/v4";

import { ai } from "~/infrastructure/ai";
import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { createUsageRuntime } from "~/modules/usage/application/runtime";

import { runWithSystemModel, type SystemModelScope } from "./resolve";

export interface SystemObjectRequest<TObject> {
  role: SystemModelRole;
  scope?: SystemModelScope;
  name: string;
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
    },
    request.scope,
  );
}
