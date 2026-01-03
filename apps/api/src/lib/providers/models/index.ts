import { KVCache } from "~/lib/cache";
import { RepositoryManager } from "~/repositories";
import type {
	IEnv,
	IUser,
	IUserSettings,
	ModelConfig,
	ModelConfigItem,
	ModelModalities,
	ModelModality,
	ResearchProviderName,
	SearchProviderName,
} from "~/types";
import { getLogger } from "~/utils/logger";
import { anthropicModelConfig } from "~/data-model/models/anthropic";
import { azureModelConfig } from "~/data-model/models/azure";
import { bedrockModelConfig } from "~/data-model/models/bedrock";
import { chutesModelConfig } from "~/data-model/models/chutes";
import { type availableModalities, defaultModel } from "~/constants/models";
import { AssistantError, ErrorType } from "~/utils/errors";
import { deepinfraModelConfig } from "~/data-model/models/deepinfra";
import { deepseekModelConfig } from "~/data-model/models/deepseek";
import { fireworksModelConfig } from "~/data-model/models/fireworks";
import { githubCopilotModelConfig } from "~/data-model/models/githubcopilot";
import { githubModelsConfig } from "~/data-model/models/githubmodels";
import { googleAiStudioModelConfig } from "~/data-model/models/google-ai-studio";
import { groqModelConfig } from "~/data-model/models/groq";
import { huggingfaceModelConfig } from "~/data-model/models/huggingface";
import { hyperbolicModelConfig } from "~/data-model/models/hyperbolic";
import { inceptionModelConfig } from "~/data-model/models/inception";
import { inferenceModelConfig } from "~/data-model/models/inference";
import { mistralModelConfig } from "~/data-model/models/mistral";
import { morphModelConfig } from "~/data-model/models/morph";
import { ollamaModelConfig } from "~/data-model/models/ollama";
import { openaiModelConfig } from "~/data-model/models/openai";
import { openrouterModelConfig } from "~/data-model/models/openrouter";
import { parallelModelConfig } from "~/data-model/models/parallel";
import { perplexityModelConfig } from "~/data-model/models/perplexity";
import { replicateModelConfig } from "~/data-model/models/replicate";
import { requestyModelConfig } from "~/data-model/models/requesty";
import { togetherAiModelConfig } from "~/data-model/models/together-ai";
import { upstageModelConfig } from "~/data-model/models/upstage";
import { v0ModelConfig } from "~/data-model/models/v0";
import { vercelModelConfig } from "~/data-model/models/vercel";
import { workersAiModelConfig } from "~/data-model/models/workersai";
import { xaiModelConfig } from "~/data-model/models/xai";
import { exaModelConfig } from "~/data-model/models/exa";
import { cerebrasModelConfig } from "~/data-model/models/cerebras";
import { falModelConfig } from "~/data-model/models/fal";

const logger = getLogger({ prefix: "lib/models" });

let cachedModels: typeof modelConfig | null = null;
let cachedFreeModels: typeof modelConfig | null = null;
let cachedFeaturedModels: typeof modelConfig | null = null;
let cachedRouterModels: typeof modelConfig | null = null;
let cachedCapabilities: string[] | null = null;

export interface ModelsOptions {
	shouldUseCache?: boolean;
	excludeModalities?: ModelModality[];
}

const modelConfig: ModelConfig = {
	...openaiModelConfig,
	...anthropicModelConfig,
	...mistralModelConfig,
	...morphModelConfig,
	...ollamaModelConfig,
	...bedrockModelConfig,
	...deepinfraModelConfig,
	...deepseekModelConfig,
	...azureModelConfig,
	...githubModelsConfig,
	...xaiModelConfig,
	...groqModelConfig,
	...huggingfaceModelConfig,
	...openrouterModelConfig,
	...parallelModelConfig,
	...perplexityModelConfig,
	...requestyModelConfig,
	...workersAiModelConfig,
	...togetherAiModelConfig,
	...googleAiStudioModelConfig,
	...fireworksModelConfig,
	...hyperbolicModelConfig,
	...inferenceModelConfig,
	...chutesModelConfig,
	...vercelModelConfig,
	...upstageModelConfig,
	...githubCopilotModelConfig,
	...inceptionModelConfig,
	...v0ModelConfig,
	...replicateModelConfig,
	...exaModelConfig,
	...falModelConfig,
	...cerebrasModelConfig,
};

const MODEL_CACHE_TTL = 14400;
const USER_MODEL_CACHE_TTL = 3600;
let modelCache: KVCache | null = null;

const DEFAULT_MODALITIES: ModelModalities = {
	input: ["text"],
	output: ["text"],
};

function getModelModalities(model: ModelConfigItem): ModelModalities {
	return model.modalities ?? DEFAULT_MODALITIES;
}

function modelSupportsModality(
	model: ModelConfigItem,
	modality: ModelModality,
) {
	const modalities = getModelModalities(model);
	return (
		modalities.input.includes(modality) || modalities.output.includes(modality)
	);
}

function getModelCache(env: IEnv): KVCache | null {
	if (!env.CACHE) return null;

	if (!modelCache) {
		modelCache = new KVCache(env.CACHE, MODEL_CACHE_TTL);
	}
	return modelCache;
}

function getUserModelCache(env: IEnv): KVCache | null {
	if (!env.CACHE) return null;

	return new KVCache(env.CACHE, USER_MODEL_CACHE_TTL);
}

/**
 * Generic caching helper that handles cache read/write operations
 */
async function withCache<T>(
	env: IEnv | undefined,
	cacheKeyPrefix: string,
	cacheKeyParts: string[],
	computeFn: () => T | Promise<T>,
): Promise<T> {
	if (!env?.CACHE) {
		return computeFn();
	}

	const cache = getModelCache(env);
	if (!cache) {
		return computeFn();
	}

	const cacheKey = KVCache.createKey(cacheKeyPrefix, ...cacheKeyParts);

	const cached = await cache.get<T>(cacheKey);
	if (cached !== null) {
		return cached;
	}

	const result = await computeFn();

	if (result !== null && result !== undefined) {
		cache.set(cacheKey, result).catch(() => {});
	}

	return result;
}

export async function getModelConfig(model?: string, env?: IEnv) {
	const key = model || defaultModel;

	return withCache(
		env,
		"model-config",
		[key],
		() => (model && modelConfig[model]) || modelConfig[defaultModel],
	);
}

export async function getModelConfigByModel(model: string, env?: IEnv) {
	return withCache(
		env,
		"model-by-model",
		[model],
		() => model && modelConfig[model as keyof typeof modelConfig],
	);
}

export async function getMatchingModel(
	model: string = defaultModel,
	env?: IEnv,
) {
	return withCache(env, "matching-model", [model], async () => {
		const config = await getModelConfig(model, env);
		return config?.matchingModel;
	});
}

export async function getModelConfigByMatchingModel(
	matchingModel: string,
	env?: IEnv,
) {
	return withCache(env, "model-by-matching", [matchingModel], () => {
		for (const model in modelConfig) {
			if (
				modelConfig[model as keyof typeof modelConfig].matchingModel ===
				matchingModel
			) {
				return modelConfig[model as keyof typeof modelConfig];
			}
		}
		return null;
	});
}

export function getModels(
	options: ModelsOptions = {
		shouldUseCache: true,
		excludeModalities: [],
	},
) {
	if (cachedModels && options.shouldUseCache) {
		return cachedModels;
	}

	cachedModels = Object.entries(modelConfig).reduce((acc, [key, model]) => {
		if (
			!model.beta &&
			!options.excludeModalities?.some((excluded) =>
				modelSupportsModality(model, excluded),
			)
		) {
			acc[key] = model;
		}
		return acc;
	}, {});

	return cachedModels;
}

export function getAvailableStrengths(): string[] {
	if (cachedCapabilities) {
		return cachedCapabilities;
	}

	const capabilities = new Set<string>();
	for (const model of Object.values(modelConfig)) {
		for (const capability of model.strengths ?? []) {
			capabilities.add(capability);
		}
	}

	cachedCapabilities = Array.from(capabilities);
	return cachedCapabilities;
}

export function getFreeModels(
	options: ModelsOptions = {
		shouldUseCache: true,
	},
) {
	if (cachedFreeModels && options.shouldUseCache) {
		return cachedFreeModels;
	}

	cachedFreeModels = Object.entries(modelConfig).reduce(
		(acc, [key, model]) => {
			if (model.isFree) {
				acc[key] = model;
			}
			return acc;
		},
		{} as typeof modelConfig,
	);

	return cachedFreeModels;
}

export function getFeaturedModels(
	options: ModelsOptions = {
		shouldUseCache: true,
	},
) {
	if (cachedFeaturedModels && options.shouldUseCache) {
		return cachedFeaturedModels;
	}

	cachedFeaturedModels = Object.entries(modelConfig).reduce(
		(acc, [key, model]) => {
			if (model.isFeatured) {
				acc[key] = model;
			}
			return acc;
		},
		{} as typeof modelConfig,
	);

	return cachedFeaturedModels;
}

export function getIncludedInRouterModels(
	options: ModelsOptions = {
		shouldUseCache: true,
	},
) {
	if (cachedRouterModels && options.shouldUseCache) {
		return cachedRouterModels;
	}

	cachedRouterModels = Object.entries(modelConfig).reduce(
		(acc, [key, model]) => {
			if (model.includedInRouter) {
				acc[key] = model;
			}
			return acc;
		},
		{} as typeof modelConfig,
	);

	return cachedRouterModels;
}

export function getIncludedInRouterFreeModels(
	options: ModelsOptions = {
		shouldUseCache: true,
	},
) {
	return Object.entries(getIncludedInRouterModels(options)).reduce(
		(acc, [key, model]) => {
			if (model.isFree) {
				acc[key] = model;
			}
			return acc;
		},
		{} as typeof modelConfig,
	);
}

export async function getIncludedInRouterModelsForUser(
	env: IEnv,
	userId?: number,
	options: ModelsOptions = {
		shouldUseCache: true,
	},
): Promise<Record<string, ModelConfigItem>> {
	if (!userId) {
		const freeModels = getIncludedInRouterFreeModels(options);
		return await filterModelsForUserAccess(freeModels, env, userId, options);
	}

	const repositories = new RepositoryManager(env);
	const user = await repositories.users.getUserById(userId);
	const isPro = user?.plan_id === "pro";

	if (!isPro) {
		const freeModels = getIncludedInRouterFreeModels(options);
		return await filterModelsForUserAccess(freeModels, env, userId, options);
	}

	const allRouterModels = getIncludedInRouterModels(options);
	return await filterModelsForUserAccess(allRouterModels, env, userId, options);
}

export function getModelsByCapability(capability: string) {
	return Object.entries(modelConfig).reduce(
		(acc, [key, model]) => {
			if (
				model.strengths?.includes(
					capability as (typeof availableModalities)[number],
				)
			) {
				acc[key] = model;
			}
			return acc;
		},
		{} as typeof modelConfig,
	);
}

export function getModelsByModality(modality: ModelModality) {
	return Object.entries(modelConfig).reduce(
		(acc, [key, model]) => {
			if (modelSupportsModality(model, modality)) {
				acc[key] = model;
			}
			return acc;
		},
		{} as typeof modelConfig,
	);
}

export function getModelsByOutputModality(modality: ModelModality) {
	return Object.entries(modelConfig).reduce(
		(acc, [key, model]) => {
			const outputs = model.modalities?.output ?? [];
			if (outputs.includes(modality)) {
				acc[key] = model;
			}
			return acc;
		},
		{} as typeof modelConfig,
	);
}

export async function filterModelsForUserAccess(
	allModels: Record<string, ModelConfigItem>,
	env: IEnv,
	userId?: number,
	options: ModelsOptions = { shouldUseCache: true },
): Promise<Record<string, ModelConfigItem>> {
	const cache = getUserModelCache(env);
	const cacheKey = KVCache.createKey(
		"user-models",
		userId?.toString() || "anonymous",
	);

	if (cache && options.shouldUseCache) {
		const cached = await cache.get<Record<string, ModelConfigItem>>(cacheKey);
		if (cached) {
			return cached;
		}
	}

	const allFreeModels = getFreeModels();
	const alwaysEnabledProvidersEnvVar = env.ALWAYS_ENABLED_PROVIDERS;
	const alwaysEnabledProviders = new Set(
		alwaysEnabledProvidersEnvVar?.split(",") || [],
	);

	const freeModels: Record<string, ModelConfigItem> = {};
	for (const modelId in allFreeModels) {
		const model = allFreeModels[modelId];
		if (alwaysEnabledProviders.has(model.provider)) {
			freeModels[modelId] = model;
		}
	}
	const freeModelIds = new Set(Object.keys(freeModels));

	const filteredModels: Record<string, ModelConfigItem> = {};

	if (!userId) {
		for (const modelId in allModels) {
			if (
				freeModelIds.has(modelId) ||
				alwaysEnabledProviders.has(allModels[modelId].provider)
			) {
				filteredModels[modelId] = allModels[modelId];
			}
		}

		if (cache && options.shouldUseCache) {
			cache.set(cacheKey, filteredModels).catch(() => {});
		}

		return filteredModels;
	}

	try {
		const repositories = new RepositoryManager(env);

		const userProviderSettings = await withCache(
			env,
			"user-provider-settings",
			[userId.toString()],
			() => repositories.userSettings.getUserProviderSettings(userId),
		);

		const enabledProviders = new Map(
			userProviderSettings
				.filter((p) => p.enabled)
				.map((p) => [p.provider_id, true]),
		);

		for (const modelId in allModels) {
			const model = allModels[modelId];
			const isFree = freeModelIds.has(modelId);
			const isEnabled =
				alwaysEnabledProviders.has(model.provider) ||
				enabledProviders.has(model.provider);

			if (isFree || isEnabled) {
				filteredModels[modelId] = model;
			}
		}

		if (cache) {
			cache.set(cacheKey, filteredModels).catch(() => {});
		}

		return filteredModels;
	} catch (error) {
		logger.error(`Error during model filtering for user ${userId}`, { error });
		return freeModels;
	}
}

/**
 * Get the appropriate model to use for auxiliary tasks like summarization,
 * classification, etc., based on which models are available.
 * @param env The environment object
 * @param user Optional user for model access check
 * @returns Object containing model ID and provider
 */
export async function getAuxiliaryModel(
	env: IEnv,
	user?: IUser,
): Promise<{ model: string; provider: string }> {
	let modelToUse = "gemma-3-12b-it";

	const availableModels = await getIncludedInRouterModelsForUser(env, user?.id);

	const hasGroqModel = Object.keys(availableModels).some(
		(model) => availableModels[model].provider === "groq",
	);

	if (hasGroqModel) {
		modelToUse = "llama-3.3-70b-versatile";
		return { model: modelToUse, provider: "groq" };
	}

	const modelConfig = await getModelConfig(modelToUse, env);

	return { model: modelConfig.matchingModel, provider: modelConfig.provider };
}

export const getAuxiliaryModelForRetrieval = async (
	env: IEnv,
	user?: IUser,
) => {
	let modelToUse = "gemma-3-12b-it";

	const availableModels = await getIncludedInRouterModelsForUser(env, user?.id);

	const hasPerplexityModel = Object.keys(availableModels).some(
		(model) => availableModels[model].provider === "perplexity-ai",
	);

	if (hasPerplexityModel) {
		modelToUse = "sonar";
	}

	const modelConfig = await getModelConfig(modelToUse, env);

	return { model: modelConfig.matchingModel, provider: modelConfig.provider };
};

export const getAuxiliaryGuardrailsModel = async (env: IEnv, user?: IUser) => {
	let modelToUse = "@cf/meta/llama-guard-3-8b";

	const availableModels = await getIncludedInRouterModelsForUser(env, user?.id);

	const hasGroqModel = Object.keys(availableModels).some(
		(model) => availableModels[model].provider === "groq",
	);

	if (hasGroqModel) {
		modelToUse = "meta-llama/llama-guard-4-12b";
		return { model: modelToUse, provider: "groq" };
	}

	const modelConfig = await getModelConfig(modelToUse, env);
	const provider = modelConfig.provider;

	return { model: modelToUse, provider };
};

export const getAuxiliarySearchProvider = async (
	env: IEnv,
	user?: IUser,
	requestedProvider?: SearchProviderName,
): Promise<SearchProviderName> => {
	const isProUser = user?.plan_id === "pro";

	if (!isProUser) {
		if (requestedProvider && requestedProvider !== "duckduckgo") {
			throw new AssistantError(
				"Requested provider requires a Pro plan",
				ErrorType.AUTHORISATION_ERROR,
			);
		}
		return "duckduckgo";
	}

	if (requestedProvider) {
		return requestedProvider;
	}

	if (user?.id) {
		const repositories = new RepositoryManager(env);
		const userSettings = await withCache(
			env,
			"user-settings",
			[user.id.toString()],
			() => repositories.userSettings.getUserSettings(user.id),
		);

		const userPreferredProvider = userSettings?.search_provider as
			| SearchProviderName
			| undefined;

		if (userPreferredProvider) {
			return userPreferredProvider;
		}
	}

	return "tavily";
};

export const getAuxiliaryResearchProvider = async (
	env: IEnv,
	user?: IUser,
	requestedProvider?: ResearchProviderName,
): Promise<ResearchProviderName> => {
	const providerToUse = requestedProvider ?? "parallel";

	if (providerToUse !== "parallel" && providerToUse !== "exa") {
		throw new AssistantError(
			`Unsupported research provider: ${providerToUse}`,
			ErrorType.PARAMS_ERROR,
		);
	}

	const isProUser = user?.plan_id === "pro";

	if (!isProUser) {
		throw new AssistantError(
			"Research tasks require a Pro plan",
			ErrorType.AUTHORISATION_ERROR,
		);
	}

	if (!user?.id) {
		throw new AssistantError(
			"Research tasks require an authenticated user",
			ErrorType.AUTHORISATION_ERROR,
		);
	}

	const repositories = new RepositoryManager(env);

	const providerSettings = await withCache(
		env,
		"user-provider-settings",
		[user.id.toString()],
		() => repositories.userSettings.getUserProviderSettings(user.id),
	);

	const hasProvider = Array.isArray(providerSettings)
		? providerSettings.some((setting: any) => {
				const isEnabled = Boolean(setting?.enabled);
				return setting?.provider_id === providerToUse && isEnabled;
			})
		: false;

	if (!hasProvider) {
		throw new AssistantError(
			`${providerToUse} research provider is not enabled for this account`,
			ErrorType.AUTHORISATION_ERROR,
		);
	}

	return providerToUse;
};

export const getAuxiliarySpeechModel = async (
	env: IEnv,
	userSettings?: IUserSettings,
): Promise<{
	model: string;
	provider: string;
	transcriptionProvider: string;
}> => {
	const transcriptionProvider =
		userSettings?.transcription_provider || "workers";
	const transcriptionModel = userSettings?.transcription_model || "whisper";

	const modelConfig = await getModelConfig(transcriptionModel, env);

	return {
		model: modelConfig.matchingModel,
		provider: modelConfig.provider,
		transcriptionProvider,
	};
};

export {
	availableModalities,
	defaultModel,
	defaultProvider,
} from "~/constants/models";
