import {
  ParallelResearchProvider,
  ExaResearchProvider,
} from "../capabilities/research/providers/index.js";
import type { AiProviderRegistration, AiProviderRegistry, ProviderRuntime } from "../runtime.js";
import type { ResearchProvider } from "../types/index.js";
import { ensureEnv, ensureUser } from "./utils.js";

function researchProviders(runtime: ProviderRuntime): AiProviderRegistration<ResearchProvider>[] {
  return [
    {
      name: "parallel",
      lifecycle: "transient",
      create: (context) => {
        const env = ensureEnv(context);
        const user = ensureUser(context, { optional: true });

        return new ParallelResearchProvider(env, user, runtime);
      },
      metadata: { vendor: "Parallel", categories: ["research"] },
    },
    {
      name: "exa",
      lifecycle: "transient",
      create: (context) => {
        const env = ensureEnv(context);
        const user = ensureUser(context, { optional: true });

        return new ExaResearchProvider(env, user, runtime);
      },
      metadata: { vendor: "Exa", categories: ["research"] },
    },
  ];
}

export function registerResearchProviders(
  registry: AiProviderRegistry,
  runtime: ProviderRuntime,
): void {
  for (const registration of researchProviders(runtime)) {
    registry.register("research", registration);
  }
}
