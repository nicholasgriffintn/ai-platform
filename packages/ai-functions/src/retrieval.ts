import type {
  GuardrailInput,
  GuardrailResult,
  GuardrailSource,
  ProviderEnv,
  ProviderRuntime,
  ProviderUser,
  ResearchOptions,
  ResearchResult,
  SearchOptions,
  SearchResult,
} from "@ngriffin_uk/polychat-ai-providers";

export interface RetrievalScope {
  env: ProviderEnv;
  user?: ProviderUser;
}

export interface SearchRequest extends RetrievalScope {
  provider: string;
  query: string;
  options?: SearchOptions;
}

export interface ResearchRequest extends RetrievalScope {
  provider: string;
  input: unknown;
  options?: ResearchOptions;
}

export interface GuardRequest extends RetrievalScope {
  provider: string;
  config?: unknown;
  content: GuardrailInput;
  source: GuardrailSource;
}

export function createRetrievalFunctions(runtime: ProviderRuntime) {
  return {
    search: ({ provider, query, options, env, user }: SearchRequest): Promise<SearchResult> =>
      runtime.providers.resolve("search", provider, { env, user }).performWebSearch(query, options),
    research: ({ provider, input, options, env, user }: ResearchRequest): Promise<ResearchResult> =>
      runtime.providers
        .resolve("research", provider, { env, user })
        .performResearch(input, options),
    guard: ({
      provider,
      config,
      content,
      source,
      env,
      user,
    }: GuardRequest): Promise<GuardrailResult> =>
      runtime.providers
        .resolve("guardrails", provider, { env, user, config })
        .validateContent(content, source),
  };
}

export type RetrievalFunctions = ReturnType<typeof createRetrievalFunctions>;
