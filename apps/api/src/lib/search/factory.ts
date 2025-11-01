import type { IEnv, IUser, SearchProviderName } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { ParallelSearchProvider } from "./parallel";
import { SerperProvider } from "./serper";
import { TavilyProvider } from "./tavily";

// biome-ignore lint/complexity/noStaticOnlyClass: I prefer this pattern
export class SearchProviderFactory {
  static getProvider(
    providerName: SearchProviderName,
    env: IEnv,
    user?: IUser,
  ) {
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
      case "parallel":
        if (!env.AI_GATEWAY_TOKEN) {
          throw new AssistantError(
            "AI_GATEWAY_TOKEN is not set",
            ErrorType.CONFIGURATION_ERROR,
            500,
            { provider: "parallel" },
          );
        }
        return new ParallelSearchProvider(env, user);
      default:
        throw new AssistantError(`Unknown search provider: ${providerName}`);
    }
  }
}
