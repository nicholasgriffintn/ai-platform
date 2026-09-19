import type { RerankProvider } from "../capabilities/rerank/index.js";
import {
  GREENPT_RERANK_MODELS,
  GreenPtRerankProvider,
} from "../capabilities/rerank/providers/index.js";
import type { AiProviderRegistration, AiProviderRegistry, ProviderRuntime } from "../runtime.js";

function rerankProviders(runtime: ProviderRuntime): AiProviderRegistration<RerankProvider>[] {
  return [
    {
      name: "greenpt",
      create: () => new GreenPtRerankProvider(runtime),
      metadata: {
        vendor: "GreenPT",
        categories: ["rerank"],
        models: GREENPT_RERANK_MODELS,
        defaultModel: "green-rerank",
      },
    },
  ];
}

export function registerRerankProviders(
  registry: AiProviderRegistry,
  runtime: ProviderRuntime,
): void {
  for (const registration of rerankProviders(runtime)) {
    registry.register("rerank", registration);
  }
}
