import { UserSettingsRepository } from "~/repositories/UserSettingsRepository";
import type {
	IEnv,
	IUser,
	PerplexitySearchResult,
	SearchOptions,
	SearchProvider,
	SearchResult,
} from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { gatewayId } from "../../constants/app";

export class PerplexityProvider implements SearchProvider {
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
					"perplexity-ai",
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

		const envKey = this.env.PERPLEXITY_API_KEY;
		if (!envKey) {
			throw new AssistantError(
				"PERPLEXITY_API_KEY is not set",
				ErrorType.CONFIGURATION_ERROR,
				500,
				{ provider: "perplexity" },
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
		const requestBody: Record<string, unknown> = {
			query,
			max_results: options?.max_results || 10,
			max_tokens_per_page: 1024,
		};

		if (options?.country) {
			requestBody.country = options.country;
		}

		if (options?.language) {
			requestBody.search_language_filter = [options.language];
		}

		const endpoint = `https://gateway.ai.cloudflare.com/v1/${this.env.ACCOUNT_ID}/${gatewayId}/perplexity-ai/search`;

		const response = await fetch(endpoint, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${apiKey}`,
			},
			body: JSON.stringify(requestBody),
		});

		if (!response.ok) {
			const error = await response.text();
			return {
				status: "error",
				error: `Error performing web search: ${error}`,
			};
		}

		// TODO: Perplexity doesn't return answers, should it?

		const data = (await response.json()) as PerplexitySearchResult;

		const result: PerplexitySearchResult = {
			provider: "perplexity",
			results: data.results || [],
			id: data.id,
		};

		return result;
	}
}
