import { sanitiseInput } from "~/lib/chat/utils";
import { getAuxiliarySearchProvider } from "~/lib/models";
import { providerLibrary } from "~/lib/providers/library";
import type {
	IEnv,
	IFunctionResponse,
	IUser,
	SearchOptions,
	SearchProviderName,
} from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

type WebSearchRequest = {
	env: IEnv;
	query: string;
	user?: IUser;
	provider?: SearchProviderName;
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
	const searchProvider = providerLibrary.search(providerToUse, { env, user });
	const response = await searchProvider.performWebSearch(query, options);

	if (!response) {
		throw new AssistantError("No response from the web search service");
	}

	const resultsArray = Array.isArray((response as any)?.results)
		? (response as any).results
		: [];

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
			warning,
		},
	};
};
