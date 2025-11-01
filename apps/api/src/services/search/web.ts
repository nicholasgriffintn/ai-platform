import { sanitiseInput } from "~/lib/chat/utils";
import { getAuxiliarySearchProvider } from "~/lib/models";
import { Search } from "~/lib/search";
import type { IEnv, IFunctionResponse, IUser, SearchOptions } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

type WebSearchRequest = {
  env: IEnv;
  query: string;
  user?: IUser;
  provider?: "serper" | "tavily";
  options?: SearchOptions;
};

export const handleWebSearch = async (
  req: WebSearchRequest,
): Promise<IFunctionResponse> => {
  const { query: rawQuery, env, provider, options, user } = req;

  const query = sanitiseInput(rawQuery);

  if (!query) {
    throw new AssistantError("Missing query", ErrorType.PARAMS_ERROR);
  }

  if (query.length > 4096) {
    throw new AssistantError("Query is too long", ErrorType.PARAMS_ERROR);
  }

  const providerToUse = await getAuxiliarySearchProvider(env, user, provider);
  const search = Search.getInstance(env, providerToUse);
  const response = await search.search(query, options);

  if (!response) {
    throw new AssistantError("No response from the web search service");
  }

  return {
    status: "success",
    content: "Search completed",
    data: response,
  };
};
