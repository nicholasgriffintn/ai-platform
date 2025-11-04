import { UserSettingsRepository } from "~/repositories/UserSettingsRepository";
import type {
	IEnv,
	IUser,
	ExaAnswerResult,
	ExaSearchResult,
	SearchOptions,
	SearchProvider,
	SearchResult,
} from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

export class ExaSearchProvider implements SearchProvider {
	private env: IEnv;
	private user?: IUser;
	private apiKey?: string;
	private userSettingsRepo?: UserSettingsRepository;

	constructor(env: IEnv, user?: IUser) {
		this.env = env;
		this.user = user;

		if (user?.id && env.DB) {
			this.userSettingsRepo = new UserSettingsRepository(env);
		}
	}

	private async resolveApiKey(): Promise<string> {
		if (this.apiKey) {
			return this.apiKey;
		}

		if (this.user?.id && this.userSettingsRepo) {
			try {
				const userApiKey = await this.userSettingsRepo.getProviderApiKey(
					this.user.id,
					"exa",
				);
				if (userApiKey) {
					this.apiKey = userApiKey;
					return userApiKey;
				}
			} catch (error) {
				if (
					error instanceof AssistantError &&
					(error.type === ErrorType.NOT_FOUND ||
						error.type === ErrorType.PARAMS_ERROR)
				) {
					// Ignore missing user-specific keys so we can fall back to env key
				} else {
					throw error;
				}
			}
		}

		const envKey = this.env.PARALLEL_API_KEY;
		if (!envKey) {
			throw new AssistantError(
				"EXA_API_KEY is not set",
				ErrorType.CONFIGURATION_ERROR,
			);
		}

		this.apiKey = envKey;
		return envKey;
	}

	async performWebSearch(
		query: string,
		options?: SearchOptions,
	): Promise<SearchResult> {
		const apiKey = await this.resolveApiKey();

		const payload = options?.include_answer
			? {
					query,
					userLocation: options?.country,
					text: options?.include_raw_content ? true : false,
					systemPrompt: options?.system_prompt || "",
				}
			: {
					query,
					type: "auto",
					userLocation: options?.country,
					numResults: options?.max_results || 5,
					contents: {
						text: options?.include_raw_content ? true : false,
					},
				};

		const endpoint = options.include_answer
			? `https://api.exa.ai/answer`
			: `https://api.exa.ai/search`;

		try {
			const response = await fetch(endpoint, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-api-key": apiKey,
				},
				body: JSON.stringify(payload),
			});

			if (!response.ok) {
				const errorText = await response.text();
				return {
					status: "error",
					error: `Error performing web search: ${errorText}`,
				};
			}

			const data = (await response.json()) as ExaSearchResult | ExaAnswerResult;

			if ("citations" in data) {
				return {
					provider: "exa",
					results: data.citations || [],
					...data,
				};
			}

			return {
				provider: "exa",
				results: data.results || [],
			};
		} catch (error) {
			return {
				status: "error",
				error:
					error instanceof Error
						? `Error performing web search: ${error.message}`
						: "Error performing web search",
			};
		}
	}
}
