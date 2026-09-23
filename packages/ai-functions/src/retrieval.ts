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
import { modelHasOutputModality } from "@ngriffin_uk/polychat-schemas";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";
import { parseOpenAiEmbeddingVectors } from "@ngriffin_uk/polychat-utility-server/embeddings";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

const MAX_EMBEDDING_INPUTS = 2_048;
const MAX_EMBEDDING_INPUT_BYTES = 1024 * 1024;

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

    if (inputs.length > MAX_EMBEDDING_INPUTS) {
      throw new AssistantError(
        `Embedding requests support at most ${MAX_EMBEDDING_INPUTS} inputs`,
        ErrorType.PARAMS_ERROR,
        400,
      );
    }

    const inputBytes = inputs.reduce(
      (total, value) => total + new TextEncoder().encode(value).byteLength,
      0,
    );

    if (inputBytes > MAX_EMBEDDING_INPUT_BYTES) {
      throw new AssistantError(
        "Embedding input must not exceed 1 MiB",
        ErrorType.PARAMS_ERROR,
        400,
      );
    }

    const modelConfig = await runtime.host.models.findModelConfig(model, env, provider, user?.id);
    const providerName = provider ?? modelConfig?.provider;

    if (!modelConfig || !providerName || !modelHasOutputModality(modelConfig, "embedding")) {
      throw new AssistantError(
        `No provider is registered for embedding model ${model}`,
        ErrorType.PARAMS_ERROR,
        400,
      );
    }

    const raw = await runtime.providers.resolve("chat", providerName, { env, user }).getResponse(
      {
        env,
        model: modelConfig.matchingModel,
        provider: providerName,
        completion_id,
        messages: [],
        context: { env, user },
        body: { input },
      },
      user?.id,
    );

    return {
      model: modelConfig.matchingModel,
      provider: providerName,
      vectors: parseOpenAiEmbeddingVectors(
        raw,
        inputs.length,
        `Invalid embedding response from ${providerName}`,
      ),
      usage: isRecord(raw) ? raw.usage : undefined,
    };
  };

  return {
    embed,
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
