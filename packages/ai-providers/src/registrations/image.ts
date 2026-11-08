import type { ImageProvider } from "../capabilities/image/index.js";
import { ModelImageProvider } from "../capabilities/image/providers/index.js";
import type { AiProviderRegistration, AiProviderRegistry, ProviderRuntime } from "../runtime.js";
import { chatProviders } from "./chat.js";

function imageProviders(runtime: ProviderRuntime): AiProviderRegistration<ImageProvider>[] {
  return chatProviders(runtime).map((chat) => ({
    name: chat.name,
    aliases: chat.aliases,
    create: () => new ModelImageProvider(runtime, chat.name),
    metadata: { vendor: chat.metadata?.vendor, categories: ["image"] },
  }));
}

export function registerImageProviders(
  registry: AiProviderRegistry,
  runtime: ProviderRuntime,
): void {
  for (const registration of imageProviders(runtime)) {
    registry.register("image", registration);
  }
}
