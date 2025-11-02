import type { IEnv, IUser, SearchProviderName } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { DuckDuckGoProvider } from "./duckduckgo";
import { ParallelSearchProvider } from "./parallel";
import { PerplexityProvider } from "./perplexity";
import { SerperProvider } from "./serper";
import { TavilyProvider } from "./tavily";

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
			case "perplexity":
				return new PerplexityProvider(env, user);
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
			case "duckduckgo":
				return new DuckDuckGoProvider();
			default:
				throw new AssistantError(`Unknown search provider: ${providerName}`);
		}
	}
}
