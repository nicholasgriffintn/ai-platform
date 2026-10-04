import {
  TYPESAFE_PROVIDER_NAME,
  TypeSafeDecisionProvider,
} from "../capabilities/decision/providers/typesafe.js";
import {
  WORKERS_AI_DECISION_PROVIDER_NAME,
  WorkersAiDecisionProvider,
} from "../capabilities/decision/providers/workers.js";
import type { AiProviderRegistration, AiProviderRegistry, ProviderRuntime } from "../runtime.js";
import type { DecisionProvider } from "../types/decision.js";
import { ensureEnv, ensureUser } from "./utils.js";

function decisionProviders(runtime: ProviderRuntime): AiProviderRegistration<DecisionProvider>[] {
  return [
    {
      name: WORKERS_AI_DECISION_PROVIDER_NAME,
      aliases: ["workers"],
      lifecycle: "transient",
      create: (context) =>
        new WorkersAiDecisionProvider(
          ensureEnv(context),
          ensureUser(context, { optional: true }),
          runtime,
        ),
      metadata: {
        vendor: "Cloudflare",
        categories: ["decision"],
        tags: ["workers-ai", "system-one", "calibrated"],
      },
    },
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
