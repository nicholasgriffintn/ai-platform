import { AnthropicBatchProvider, OpenAiBatchProvider } from "../capabilities/batch/index.js";
import type { BatchProvider } from "../capabilities/batch/types.js";
import type { AiProviderRegistration, AiProviderRegistry, ProviderRuntime } from "../runtime.js";
import { ensureEnv } from "./utils.js";

function batchProviders(runtime: ProviderRuntime): AiProviderRegistration<BatchProvider>[] {
  return [
    {
      name: "openai",
      lifecycle: "transient",
      create: (context) => new OpenAiBatchProvider(ensureEnv(context), runtime),
      metadata: { vendor: "OpenAI", categories: ["batch"] },
    },
    {
      name: "anthropic",
      lifecycle: "transient",
      create: (context) => new AnthropicBatchProvider(ensureEnv(context), runtime),
      metadata: { vendor: "Anthropic", categories: ["batch"] },
    },
  ];
}

export function registerBatchProviders(registry: AiProviderRegistry, runtime: ProviderRuntime) {
  for (const registration of batchProviders(runtime)) {
    registry.register("batch", registration);
  }
}
