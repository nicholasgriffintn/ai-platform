import type {
  GuardrailInput,
  GuardrailResult,
  GuardrailSource,
  ProviderEnv,
  ProviderRuntime,
  ProviderUser,
  RerankDocument,
  RerankResult,
  ResearchOptions,
  ResearchResult,
  SearchOptions,
  SearchResult,
} from "@ngriffin_uk/polychat-ai-providers";
import { parseOpenAiEmbeddingVectors } from "@ngriffin_uk/polychat-utility-server/embeddings";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

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

export interface RerankRequest extends RetrievalScope {
  provider: string;
  query: string;
  documents: RerankDocument[];
  model?: string;
  topN?: number;
  returnDocuments?: boolean;
}

export interface EmbedRequest extends RetrievalScope {
  model: string;
  provider?: string;
  input: string | string[];
  completion_id?: string;
}

export interface EmbedResult {
  model: string;
  provider: string;
  vectors: number[][];
  usage?: unknown;
}

export function createRetrievalFunctions(runtime: ProviderRuntime) {
  const embed = async ({
    env,
    user,
    model,
    provider,
    input,
    completion_id,
  }: EmbedRequest): Promise<EmbedResult> => {
    const inputs = Array.isArray(input) ? input : [input];

    if (inputs.length === 0 || inputs.some((value) => !value.trim())) {
      throw new AssistantError("Embedding input must not be empty", ErrorType.PARAMS_ERROR, 400);
    }

    const providerName =
      provider ?? (await runtime.host.models.findModelConfig(model, env))?.provider;

    if (!providerName) {
      throw new AssistantError(
        `No provider is registered for embedding model ${model}`,
        ErrorType.PARAMS_ERROR,
        400,
      );
    }

    const raw = await runtime.providers.resolve("chat", providerName, { env, user }).getResponse(
      {
        env,
        model,
        provider: providerName,
        completion_id,
        messages: [],
        context: { env, user },
        body: { input },
      },
      user?.id,
    );

    return {
      model,
      provider: providerName,
      vectors: parseOpenAiEmbeddingVectors(raw, `Invalid embedding response from ${providerName}`),
      usage: raw && typeof raw === "object" ? (raw as { usage?: unknown }).usage : undefined,
    };
  };

  return {
    embed,
    rerank: ({
      provider,
      query,
      documents,
      model,
      topN,
      returnDocuments,
      env,
      user,
    }: RerankRequest): Promise<RerankResult> =>
      runtime.providers
        .resolve("rerank", provider, { env, user })
        .rerank({ env, user, query, documents, model, topN, returnDocuments }),
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
