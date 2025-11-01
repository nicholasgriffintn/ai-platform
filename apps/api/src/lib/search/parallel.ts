import { gatewayId } from "~/constants/app";
import { UserSettingsRepository } from "~/repositories/UserSettingsRepository";
import type {
  IEnv,
  IUser,
  ParallelSearchResult,
  SearchOptions,
  SearchProvider,
  SearchResult,
} from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

export class ParallelSearchProvider implements SearchProvider {
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
          "parallel",
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
        "PARALLEL_API_KEY is not set",
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
    if (!this.env.AI_GATEWAY_TOKEN) {
      throw new AssistantError(
        "AI_GATEWAY_TOKEN is not set",
        ErrorType.CONFIGURATION_ERROR,
      );
    }

    const apiKey = await this.resolveApiKey();
    const providedQueries = options?.parallel_search_queries;
    const searchQueries =
      providedQueries && providedQueries.length > 0 ? providedQueries : [query];
    const objective = options?.parallel_objective || query;
    const payload = {
      objective,
      search_queries: searchQueries,
      processor: options?.parallel_processor || "base",
      max_results: options?.max_results ?? 10,
      max_chars_per_result: options?.parallel_max_chars_per_result ?? 6000,
    };

    const endpoint = `https://gateway.ai.cloudflare.com/v1/${this.env.ACCOUNT_ID}/${gatewayId}/parallel/v1beta/search`;

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "cf-aig-authorization": this.env.AI_GATEWAY_TOKEN,
          "cf-aig-metadata": JSON.stringify({
            userId: this.user?.id,
            email: this.user?.email,
            provider: "parallel",
          }),
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

      const data = (await response.json()) as ParallelSearchResult;
      return {
        provider: "parallel",
        ...data,
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
