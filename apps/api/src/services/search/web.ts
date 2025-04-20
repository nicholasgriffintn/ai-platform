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
  const { query, env, provider = "tavily", options } = req;

  if (!query) {
    throw new AssistantError("Missing query", ErrorType.PARAMS_ERROR);
  }

  if (query.length > 4096) {
    throw new AssistantError("Query is too long", ErrorType.PARAMS_ERROR);
  }

  const search = Search.getInstance(env, provider);
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
