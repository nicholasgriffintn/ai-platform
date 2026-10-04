import { normaliseSearchSources } from "@ngriffin_uk/polychat-ai-providers";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { sanitiseInput } from "@ngriffin_uk/polychat-utility-server/sanitise";

import { getSearchProvider } from "~/infrastructure/providers/capabilities/search";
import { getAuxiliarySearchProvider } from "~/modules/models/application/resolve";
import type { IEnv, IUser, SearchOptions, SearchProviderName } from "~/types";

type WebSearchRequest = {
  env: IEnv;
  query: string;
  user?: IUser;
  provider?: SearchProviderName;
  options?: SearchOptions;
};

export const handleWebSearch = async (req: WebSearchRequest) => {
  const { query: rawQuery, env, provider, options, user } = req;

  const query = sanitiseInput(rawQuery);

  if (!query) {
    throw new AssistantError("Missing query", ErrorType.PARAMS_ERROR);
  }

  if (query.length > 4096) {
    throw new AssistantError("Query is too long", ErrorType.PARAMS_ERROR);
  }

  const providerToUse = await getAuxiliarySearchProvider(env, user, provider);
  const searchProvider = getSearchProvider(providerToUse, { env, user });
  const response = await searchProvider.performWebSearch(query, options);

  if (response && "status" in response && response.status === "error") {
    throw new AssistantError(response.error, ErrorType.PROVIDER_ERROR, 502);
  }

  if (!response) {
    throw new AssistantError("No response from the web search service");
  }

  const sources = normaliseSearchSources(response);
  const resultsArray = "results" in response ? response.results : sources;

  const warning =
    providerToUse === "duckduckgo"
      ? "Results may be limited when using DuckDuckGo. Upgrade to a Pro plan for richer web search results."
      : undefined;

  return {
    status: "success",
    content: "Search completed",
    data: {
      provider: providerToUse,
      result: response,
      results: resultsArray,
      sources,
      warning,
    },
  };
};
