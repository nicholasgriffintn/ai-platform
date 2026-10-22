import {
  WORKERS_AI_EXTRACTION_PROVIDER_NAME,
  WorkersAiExtractionProvider,
} from "../capabilities/extraction/providers/workers.js";
import type { AiProviderRegistry, ProviderRuntime } from "../runtime.js";
import { ensureEnv, ensureUser } from "./utils.js";

export function registerExtractionProviders(
  registry: AiProviderRegistry,
  runtime: ProviderRuntime,
): void {
  registry.register("extraction", {
    name: WORKERS_AI_EXTRACTION_PROVIDER_NAME,
    aliases: ["workers"],
    lifecycle: "transient",
    create: (context) =>
      new WorkersAiExtractionProvider(
        ensureEnv(context),
        ensureUser(context, { optional: true }),
        runtime,
      ),
    metadata: {
      vendor: "Cloudflare",
      categories: ["extraction"],
      tags: ["workers-ai", "system-one", "calibrated"],
    },
  });
}
