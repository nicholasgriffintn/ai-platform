import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import {
  DuckDuckGoProvider,
  ExaSearchProvider,
  ParallelSearchProvider,
  PerplexityProvider,
  SerperProvider,
  TavilyProvider,
} from "../capabilities/search/providers/index.js";
import type { AiProviderRegistration, AiProviderRegistry, ProviderRuntime } from "../runtime.js";
import type { SearchProvider } from "../types/index.js";
import { ensureEnv, ensureUser } from "./utils.js";

function searchProviders(runtime: ProviderRuntime): AiProviderRegistration<SearchProvider>[] {
  return [
    {
      name: "serper",
      create: (context) => {
        const env = ensureEnv(context);

        if (!env.SERPER_API_KEY) {
          throw new AssistantError(
            "SERPER_API_KEY is required for the Serper search provider",
            ErrorType.CONFIGURATION_ERROR,
          );
        }

        return new SerperProvider(env);
      },
      metadata: { vendor: "Serper", categories: ["search"] },
    },
    {
      name: "tavily",
      create: (context) => {
        const env = ensureEnv(context);

        if (!env.TAVILY_API_KEY) {
          throw new AssistantError(
            "TAVILY_API_KEY is required for the Tavily search provider",
            ErrorType.CONFIGURATION_ERROR,
          );
        }

        return new TavilyProvider(env);
      },
      metadata: { vendor: "Tavily", categories: ["search"], tags: ["research"] },
    },
    {
      name: "perplexity",
      lifecycle: "transient",
      create: (context) => {
        const env = ensureEnv(context);
        const user = ensureUser(context, { optional: true });

        return new PerplexityProvider(env, user, runtime);
      },
      metadata: { vendor: "Perplexity", categories: ["search", "chat"] },
    },
    {
      name: "parallel",
      lifecycle: "transient",
      create: (context) => {
        const env = ensureEnv(context);

        if (!env.AI_GATEWAY_TOKEN) {
          throw new AssistantError(
            "AI_GATEWAY_TOKEN is required for the Parallel search provider",
            ErrorType.CONFIGURATION_ERROR,
          );
        }

        const user = ensureUser(context, { optional: true });

        return new ParallelSearchProvider(env, user, runtime);
      },
      metadata: { vendor: "Parallel", categories: ["search", "research"] },
    },
    {
      name: "duckduckgo",
      create: () => new DuckDuckGoProvider(),
      metadata: { vendor: "DuckDuckGo", categories: ["search"] },
    },
    {
      name: "exa",
      lifecycle: "transient",
      create: (context) => {
        const env = ensureEnv(context);
        const user = ensureUser(context, { optional: true });

        return new ExaSearchProvider(env, user, runtime);
      },
      metadata: { vendor: "Exa", categories: ["search", "research"] },
    },
  ];
}

export function registerSearchProviders(
  registry: AiProviderRegistry,
  runtime: ProviderRuntime,
): void {
  for (const registration of searchProviders(runtime)) {
    registry.register("search", registration);
  }
}
