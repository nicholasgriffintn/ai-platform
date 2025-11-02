import type {
	IEnv,
	SearchOptions,
	SearchProvider,
	SearchResult,
	TavilySearchResult,
} from "~/types";

export class TavilyProvider implements SearchProvider {
	private apiKey;

	constructor(env: IEnv) {
		this.apiKey = env.TAVILY_API_KEY;
	}

	async performWebSearch(
		query: string,
		options?: SearchOptions,
	): Promise<SearchResult> {
		const response = await fetch("https://api.tavily.com/search", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${this.apiKey}`,
			},
			body: JSON.stringify({
				query,
				search_depth: options?.search_depth || "basic",
				include_answer: options?.include_answer || false,
				include_raw_content: options?.include_raw_content || false,
				include_images: options?.include_images || false,
				max_results: options?.max_results || 9,
			}),
		});

		if (!response.ok) {
			const error = await response.text();
			return {
				status: "error",
				error: `Error performing web search: ${error}`,
			};
		}

		const data = (await response.json()) as TavilySearchResult;
		return {
			...data,
			provider: "tavily",
		};
	}
}
