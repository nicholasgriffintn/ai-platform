import {
  COHERE_RERANKING_PROVIDER_NAME,
  CohereRerankingProvider,
  WORKERS_AI_RERANKING_PROVIDER_NAME,
  WorkersAiRerankingProvider,
} from "../capabilities/reranking/providers/index.js";
import type { AiProviderRegistration, AiProviderRegistry, ProviderRuntime } from "../runtime.js";
import type { RerankingProvider } from "../types/reranking.js";
import { ensureEnv, ensureUser } from "./utils.js";

function rerankingProviders(runtime: ProviderRuntime): AiProviderRegistration<RerankingProvider>[] {
  return [
    {
      name: WORKERS_AI_RERANKING_PROVIDER_NAME,
      aliases: ["workers"],
      lifecycle: "transient",
      create: (context) =>
        new WorkersAiRerankingProvider(
          ensureEnv(context),
          ensureUser(context, { optional: true }),
          runtime,
        ),
      metadata: {
        vendor: "Cloudflare",
        categories: ["reranking"],
        tags: ["workers-ai"],
      },
    },
    {
      name: COHERE_RERANKING_PROVIDER_NAME,
      lifecycle: "transient",
      create: (context) =>
        new CohereRerankingProvider(
          ensureEnv(context),
          ensureUser(context, { optional: true }),
          runtime,
        ),
      metadata: {
        vendor: "Cohere",
        categories: ["reranking"],
      },
    },
  ];
}

export function registerRerankingProviders(
  registry: AiProviderRegistry,
  runtime: ProviderRuntime,
): void {
  for (const registration of rerankingProviders(runtime)) {
    registry.register("reranking", registration);
  }
}
