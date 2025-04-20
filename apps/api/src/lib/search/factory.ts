import type { IEnv, SearchProviderName } from "~/types";
import { AssistantError } from "~/utils/errors";
import { SerperProvider } from "./serper";
import { TavilyProvider } from "./tavily";

// biome-ignore lint/complexity/noStaticOnlyClass: I prefer this pattern
export class SearchProviderFactory {
  static getProvider(providerName: SearchProviderName, env: IEnv) {
    switch (providerName) {
      case "serper":
        if (!env.SERPER_API_KEY) {
          throw new AssistantError("SERPER_API_KEY is not set");
        }
        return new SerperProvider(env);
      case "tavily":
        if (!env.TAVILY_API_KEY) {
          throw new AssistantError("TAVILY_API_KEY is not set");
        }
        return new TavilyProvider(env);
      default:
        throw new AssistantError(`Unknown search provider: ${providerName}`);
    }
  }
}
