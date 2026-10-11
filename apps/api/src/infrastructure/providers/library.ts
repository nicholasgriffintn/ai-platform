import { createProviderLibrary, type AIProvider } from "@ngriffin_uk/polychat-ai-providers";
import { PLATFORM_DEPLOYMENT_CHAT_PROVIDER } from "@ngriffin_uk/polychat-schemas";

import { fromProviderError } from "~/infrastructure/errors";
import { withAvailableFunctions } from "~/modules/chat/application/tools/available-functions";
import { withCapabilityMetering } from "~/modules/usage/application/capabilityMetering";
import type { ChatCompletionParameters } from "~/types";

import { HostedHermesChatProvider } from "./capabilities/agent-host/HostedHermesChatProvider";
import { DeploymentChatProvider } from "./capabilities/model-platform/DeploymentChatProvider";
import { PolychatSandboxChatProvider } from "./capabilities/sandbox/providers/PolychatSandboxChatProvider";
import { providerHost } from "./host";
import { registerEmbeddingProviders } from "./registry/registrations/embedding";
import { registerMemoryProviders } from "./registry/registrations/memory";
import { registerMessagingProviders } from "./registry/registrations/messaging";
import { registerSandboxProviders } from "./registry/registrations/sandbox";
import type {
  CategoryProviderMap,
  ProviderFactoryContext,
  ProviderRegistry,
} from "./registry/types";

function registerHostChatProviders(registry: ProviderRegistry): void {
  registry.register("chat", {
    name: "polychat-sandbox",
    create: () => new PolychatSandboxChatProvider(),
    metadata: { vendor: "Polychat", categories: ["chat"], tags: ["coding"] },
  });
  registry.register("chat", {
    name: "hermes",
    create: () => new HostedHermesChatProvider(),
    metadata: { vendor: "Nous Research", categories: ["chat"], tags: ["agent"] },
  });
  registry.register("chat", {
    name: PLATFORM_DEPLOYMENT_CHAT_PROVIDER,
    create: () => new DeploymentChatProvider(),
    metadata: { vendor: "Polychat", categories: ["chat"], tags: ["model-platform"] },
  });
}

function prepareChatRequest(params: ChatCompletionParameters): ChatCompletionParameters {
  if (params.available_functions || params.disable_functions) {
    return params;
  }

  return withAvailableFunctions(params);
}

const PREPARED_CHAT_METHODS = new Set(["getResponse", "countTokens", "getAsyncInvocationStatus"]);

function withPreparedChatRequests(provider: AIProvider): AIProvider {
  return new Proxy(provider, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);

      if (typeof value !== "function" || !PREPARED_CHAT_METHODS.has(String(property))) {
        return value;
      }

      return (...args: unknown[]) => {
        const paramsIndex = property === "getAsyncInvocationStatus" ? 1 : 0;
        const prepared = [...args];

        prepared[paramsIndex] = prepareChatRequest(args[paramsIndex] as ChatCompletionParameters);

        return Reflect.apply(value, target, prepared);
      };
    },
  });
}

export const providerLibrary = createProviderLibrary<CategoryProviderMap, ProviderFactoryContext>({
  host: providerHost,
  bootstrappers: {
    chat: [registerHostChatProviders],
    embedding: [registerEmbeddingProviders],
    memory: [registerMemoryProviders],
    messaging: [registerMessagingProviders],
    sandbox: [registerSandboxProviders],
  },
  decorators: {
    chat: (_providerName, instance) => withPreparedChatRequests(instance),
  },
  decorate: withCapabilityMetering,
  mapError: fromProviderError,
});
