import {
  TYPESAFE_PROVIDER_NAME,
  TypeSafeDecisionProvider,
} from "../capabilities/decision/providers/typesafe.js";
import type { AiProviderRegistration, AiProviderRegistry, ProviderRuntime } from "../runtime.js";
import type { DecisionProvider } from "../types/decision.js";
import { ensureEnv, ensureUser } from "./utils.js";

function decisionProviders(runtime: ProviderRuntime): AiProviderRegistration<DecisionProvider>[] {
  return [
    {
      name: TYPESAFE_PROVIDER_NAME,
      aliases: ["typesafe-ai", "jev"],
      lifecycle: "transient",
      create: (context) => {
        const env = ensureEnv(context);
        const user = ensureUser(context, { optional: true });

        return new TypeSafeDecisionProvider(env, user, runtime);
      },
      metadata: {
        vendor: "TypeSafe",
        categories: ["decision"],
        tags: ["system-one", "calibrated"],
      },
    },
  ];
}

export function registerDecisionProviders(
  registry: AiProviderRegistry,
  runtime: ProviderRuntime,
): void {
  for (const registration of decisionProviders(runtime)) {
    registry.register("decision", registration);
  }
}
