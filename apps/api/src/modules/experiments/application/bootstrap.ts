import type { FlagBootstrapResponse } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";

import { evaluationContextFor, experimentDefinitions, createFlagProvider } from "./index";

export async function buildFlagBootstrap(context: ServiceContext): Promise<FlagBootstrapResponse> {
  const evaluationContext = evaluationContextFor(context);
  const provider = createFlagProvider(context.env);
  const evaluations = await Promise.all(
    experimentDefinitions(context.env)
      .list()
      .map(async (definition) => {
        const details =
          definition.kind === "flag"
            ? await provider.resolve(definition.key, definition.defaultValue, evaluationContext)
            : await provider.resolve(definition.key, definition.control, evaluationContext);

        return {
          flagKey: details.flagKey,
          value: details.value,
          variant: details.variant,
          reason: details.reason,
        };
      }),
  );

  return { targetingKey: evaluationContext.targetingKey, evaluations };
}
