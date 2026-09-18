import {
  createExperiments,
  type Experiments,
  type FlagDefinition,
} from "@ngriffin_uk/polychat-ai-experiments";
import { resolveAnalyticsDistinctId } from "@ngriffin_uk/polychat-ai-telemetry";
import type { EvaluationContext } from "@ngriffin_uk/polychat-library-flags";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { createTelemetry, resolveTelemetryIdentity } from "~/lib/telemetry";
import type { IEnv } from "~/types";

import { createFlagProvider } from "./provider";

export { experimentDefinitions, isTaskFlagType, taskFlags, type TaskFlagType } from "./definitions";
export { createFlagProvider } from "./provider";

const experimentsByContext = new WeakMap<ServiceContext, Experiments>();

export function evaluationContextFor(
  context: Pick<ServiceContext, "user" | "anonymousUser">,
): EvaluationContext {
  const identity = resolveTelemetryIdentity(context);

  return {
    targetingKey: resolveAnalyticsDistinctId(identity),
    plan: context.user?.plan_id ?? null,
    authenticated: Boolean(context.user),
  };
}

export function experimentsFor(context: ServiceContext): Experiments {
  const cached = experimentsByContext.get(context);

  if (cached) {
    return cached;
  }

  const experiments = createExperiments({
    provider: createFlagProvider(context.env),
    context: evaluationContextFor(context),
    telemetry: createTelemetry(context.env, context.executionCtx),
    onAssign: (assignment) => {
      context.experimentAssignments[assignment.key] = assignment.variant;
    },
  });

  experimentsByContext.set(context, experiments);

  return experiments;
}

export async function evaluateServerFlag<T extends boolean | string | number>(
  env: IEnv,
  flag: FlagDefinition<T>,
): Promise<T> {
  const details = await createFlagProvider(env).resolve(flag.key, flag.defaultValue, {
    targetingKey: "server",
  });

  return details.value;
}
