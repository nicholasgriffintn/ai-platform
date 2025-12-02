import { ConversationManager } from "~/lib/conversationManager";
import { Database } from "~/lib/database";
import { RepositoryManager } from "~/repositories";
import {
	getEmbeddingProvider,
	augmentPrompt,
} from "~/lib/providers/capabilities/embedding/helpers";
import { MemoryManager } from "~/lib/memory";
import { getModelConfig } from "~/lib/providers/models";
import { getSystemPrompt } from "~/lib/prompts";
import type {
	ChatMode,
	CoreChatOptions,
	Message,
	ModelConfigInfo,
	Platform,
} from "~/types";
import { generateId } from "~/utils/id";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";
import {
	getAllAttachments,
	pruneMessagesToFitContext,
	sanitiseInput,
} from "../utils";
import type { ValidationContext } from "../validation/ValidationPipeline";
import { memoizeRequest } from "~/utils/requestCache";

const logger = getLogger({ prefix: "lib/chat/preparation/RequestPreparer" });

type ProviderModelConfig = Awaited<ReturnType<typeof getModelConfig>>;

export interface PreparedRequest {
	modelConfigs: ModelConfigInfo[];
	primaryModel: string;
	primaryModelConfig: ModelConfigInfo;
	primaryProvider: string;
	conversationManager: ConversationManager;
	messages: Message[];
	systemPrompt: string;
	messageWithContext: string;
	userSettings: any;
	currentMode: string;
	isProUser: boolean;
}

export class RequestPreparer {
	private repositories: RepositoryManager;
	private static modelConfigCache = new Map<
		string,
		Promise<ProviderModelConfig | null>
	>();

	constructor(private env: any) {
		this.repositories = new RepositoryManager(env);
	}

	public static clearModelConfigCache() {
		RequestPreparer.modelConfigCache.clear();
	}

	private static getCachedModelConfig(model: string, env: any) {
		if (!RequestPreparer.modelConfigCache.has(model)) {
			const fetchPromise = (async () => {
				try {
					const config = await getModelConfig(model, env);
					if (!config) {
						RequestPreparer.modelConfigCache.delete(model);
						return null;
					}
					return config;
				} catch (error) {
					RequestPreparer.modelConfigCache.delete(model);
					throw error;
				}
			})();
			RequestPreparer.modelConfigCache.set(model, fetchPromise);
		}

		return RequestPreparer.modelConfigCache.get(model)!;
	}

	async prepare(
		options: CoreChatOptions,
		validationContext: ValidationContext,
	): Promise<PreparedRequest> {
		const {
			sanitizedMessages,
			lastMessage,
			modelConfig: primaryModelConfig,
			messageWithContext,
		} = validationContext;

		if (!sanitizedMessages || !primaryModelConfig || !messageWithContext) {
			throw new AssistantError(
				"Missing required validation context",
				ErrorType.PARAMS_ERROR,
			);
		}

		const {
			platform = "api",
			user,
			anonymousUser,
			mode = "normal",
			executionCtx,
		} = options;
		const requestCache = options.context?.requestCache;

		const isProUser = user?.plan_id === "pro";

		const userSettingsPromise = user?.id
			? memoizeRequest(requestCache, `user-settings:${user.id}`, () =>
					this.repositories.userSettings.getUserSettings(user.id),
				)
			: Promise.resolve(null);
		const modelConfigsPromise = this.buildModelConfigs(
			options,
			validationContext,
		);
		const finalMessagePromise = (async () => {
			const resolvedSettings = await userSettingsPromise;
			return this.processMessageContent(
				options,
				validationContext,
				resolvedSettings,
			);
		})();

		const [modelConfigs, userSettings, finalMessage] = await Promise.all([
			modelConfigsPromise,
			userSettingsPromise,
			finalMessagePromise,
		]);

		const memoriesEnabled = this.shouldUseMemories(
			user,
			userSettings,
			options.store,
		);

		const primaryModel = primaryModelConfig.matchingModel;
		const primaryProvider = primaryModelConfig.provider;

		const conversationManager = ConversationManager.getInstance({
			database: new Database(this.env),
			user: user || undefined,
			anonymousUser: anonymousUser,
			model: primaryModel,
			platform,
			store: options.store,
			env: this.env,
			requestCache,
		});

		const shouldStoreMessages = options.store !== false;
		const storeMessagesTask = shouldStoreMessages
			? this.storeMessages(
					options,
					conversationManager,
					lastMessage!,
					finalMessage,
					primaryModel,
					platform,
					mode,
				)
			: null;

		const systemPromptTask = this.buildSystemPrompt(
			options,
			sanitizedMessages!,
			finalMessage,
			primaryModel,
			userSettings,
			memoriesEnabled,
		);

		if (storeMessagesTask) {
			if (executionCtx) {
				executionCtx.waitUntil(
					storeMessagesTask.catch((error) => {
						logger.error("Failed to store messages asynchronously", {
							error,
							completionId: options.completion_id,
						});
					}),
				);
			} else {
				await storeMessagesTask;
			}
		}

		const systemPrompt = await systemPromptTask;

		const messages = this.buildFinalMessages(
			sanitizedMessages!,
			messageWithContext,
			primaryModelConfig,
		);

		return {
			modelConfigs,
			primaryModel,
			primaryModelConfig,
			primaryProvider,
			conversationManager,
			messages,
			systemPrompt,
			messageWithContext,
			userSettings,
			currentMode: mode,
			isProUser,
		};
	}

	private async buildModelConfigs(
		options: CoreChatOptions,
		validationContext: ValidationContext,
	): Promise<ModelConfigInfo[]> {
		const { env } = options;

		const selectedModels = validationContext.selectedModels;

		if (!selectedModels || selectedModels.length === 0) {
			throw new AssistantError(
				"No selected models available from validation context",
				ErrorType.PARAMS_ERROR,
			);
		}

		const configPromises = selectedModels.map((model) =>
			RequestPreparer.getCachedModelConfig(model, env),
		);
		const configResults = await Promise.allSettled(configPromises);

		const successfulConfigs: ModelConfigInfo[] = [];

		configResults.forEach((result, index) => {
			if (result.status === "fulfilled" && result.value) {
				successfulConfigs.push({
					model: result.value.matchingModel,
					provider: result.value.provider,
					displayName: result.value.name || result.value.matchingModel,
				});
			} else {
				logger.warn("Failed to get model configuration", {
					model: selectedModels[index],
					error:
						result.status === "rejected" ? result.reason : "No config returned",
				});
			}
		});

		if (successfulConfigs.length === 0) {
			throw new AssistantError(
				"No valid model configurations available",
				ErrorType.CONFIGURATION_ERROR,
			);
		}

		return successfulConfigs;
	}

	private async processMessageContent(
		options: CoreChatOptions,
		validationContext: ValidationContext,
		userSettings: any,
	): Promise<string> {
		const { lastMessage } = validationContext;
		const { use_rag, rag_options, env, user } = options;

		const lastMessageContent = Array.isArray(lastMessage!.content)
			? lastMessage!.content
			: [{ type: "text" as const, text: lastMessage!.content as string }];

		const lastMessageContentText =
			lastMessageContent.find((c) => c.type === "text")?.text || "";

		const finalUserMessage = sanitiseInput(lastMessageContentText);

		if (use_rag === true) {
			const embedding = getEmbeddingProvider(env, user, userSettings);
			const augmentedPrompt = await augmentPrompt({
				provider: embedding,
				query: finalUserMessage,
				options: rag_options || {},
				env,
				user,
			});
			return augmentedPrompt
				? `${finalUserMessage}\n\n${augmentedPrompt}`
				: finalUserMessage;
		}

		return finalUserMessage;
	}

	private async storeMessages(
		options: CoreChatOptions,
		conversationManager: ConversationManager,
		lastMessage: any,
		finalMessage: string,
		primaryModel: string,
		platform: Platform,
		mode: ChatMode,
	): Promise<void> {
		const messageToStore: Message = {
			role: lastMessage.role,
			content: finalMessage,
			id: generateId(),
			timestamp: Date.now(),
			model: primaryModel,
			platform: platform || "api",
			mode,
		};

		const messagesToStore: Message[] = [messageToStore];

		const lastMessageContent = Array.isArray(lastMessage.content)
			? lastMessage.content
			: [{ type: "text" as const, text: lastMessage.content as string }];

		const { allAttachments } = getAllAttachments(lastMessageContent);

		if (allAttachments.length > 0) {
			const attachmentMessage: Message = {
				role: lastMessage.role,
				content: "Attachments",
				data: { attachments: allAttachments },
				id: generateId(),
				timestamp: Date.now(),
				model: primaryModel,
				platform: platform || "api",
				mode: mode,
			};
			messagesToStore.push(attachmentMessage);
		}

		let existingMessages: Message[] | null = null;
		try {
			if (options.completion_id) {
				existingMessages = await conversationManager.get(options.completion_id);
			}
		} catch (_error) {
			// We can ignore this.
		}

		if (
			existingMessages &&
			existingMessages?.length > options?.messages.length
		) {
			await conversationManager.replaceMessages(
				options.completion_id,
				options.messages,
			);
		} else {
			await conversationManager.addBatch(
				options.completion_id,
				messagesToStore,
				{ metadata: options.metadata || {} },
			);
		}
	}

	private async buildSystemPrompt(
		options: CoreChatOptions,
		sanitizedMessages: Message[],
		finalMessage: string,
		primaryModel: string,
		userSettings: any,
		memoriesEnabled: boolean,
	): Promise<string> {
		const {
			system_prompt,
			mode = "normal",
			verbosity,
			location,
			completion_id,
			user,
		} = options;

		const currentMode = mode;

		if (currentMode === "no_system") {
			return "";
		}

		if (system_prompt) {
			return this.enhanceSystemPromptWithMemory(
				system_prompt,
				finalMessage,
				user,
				memoriesEnabled,
			);
		}

		const systemPromptFromMessages = sanitizedMessages.find(
			(message) => message.role === "system",
		);

		if (
			systemPromptFromMessages?.content &&
			typeof systemPromptFromMessages.content === "string"
		) {
			return this.enhanceSystemPromptWithMemory(
				systemPromptFromMessages.content,
				finalMessage,
				user,
				memoriesEnabled,
			);
		}

		const generatedPrompt = await getSystemPrompt(
			{
				completion_id: completion_id!,
				input: finalMessage,
				model: primaryModel,
				date: new Date().toISOString().split("T")[0]!,
				location,
				mode: currentMode,
				verbosity,
			},
			primaryModel,
			user || undefined,
			userSettings,
		);

		return this.enhanceSystemPromptWithMemory(
			generatedPrompt,
			finalMessage,
			user,
			memoriesEnabled,
		);
	}

	private async enhanceSystemPromptWithMemory(
		systemPrompt: string,
		finalMessage: string,
		user: any,
		memoriesEnabled: boolean,
	): Promise<string> {
		const isProUser = user?.plan_id === "pro";

		if (memoriesEnabled && isProUser && finalMessage && user?.id) {
			try {
				let memoryContext = "";

				const memoryManager = MemoryManager.getInstance(this.env, user);
				const [synthesis, recentMemories] = await Promise.all([
					this.repositories.memorySyntheses.getActiveSynthesis(
						user.id,
						"global",
					),
					memoryManager.retrieveMemories(finalMessage, {
						topK: 3,
						scoreThreshold: 0.5,
					}),
				]);

				if (synthesis) {
					memoryContext += `\n\n# Memory Summary\nThe following is a consolidated summary of your long-term memories about this user:\n<memory_synthesis>\n${synthesis.synthesis_text}\n</memory_synthesis>`;
				}

				if (recentMemories.length > 0) {
					memoryContext += `\n\n# Recently Relevant Memories\nThe following specific memories are most relevant to this conversation:\n<recent_memories>\n${recentMemories
						.map((m) => `- ${m.text}`)
						.join("\n")}\n</recent_memories>`;
				}

				if (memoryContext) {
					return systemPrompt
						? `${systemPrompt}\n${memoryContext}`
						: memoryContext;
				}
			} catch (error) {
				logger.warn("Failed to retrieve memories", { error, userId: user?.id });
			}
		}

		return systemPrompt;
	}

	private shouldUseMemories(
		user: any,
		userSettings: any,
		store?: boolean,
	): boolean {
		if (store === false) {
			return false;
		}

		if (!user?.id || user?.plan_id !== "pro") {
			return false;
		}

		return Boolean(
			userSettings?.memories_save_enabled ||
				userSettings?.memories_chat_history_enabled,
		);
	}

	private buildFinalMessages(
		sanitizedMessages: Message[],
		messageWithContext: string,
		modelConfig: any,
	): Message[] {
		const prunedWithAttachments =
			sanitizedMessages.length > 0
				? pruneMessagesToFitContext(
						sanitizedMessages,
						messageWithContext,
						modelConfig,
					)
				: [];

		const chatMessages = prunedWithAttachments.map((msg, index) => {
			if (index === prunedWithAttachments.length - 1) {
				if (Array.isArray(msg.content)) {
					return {
						...msg,
						content: msg.content.map((part) =>
							part.type === "text"
								? { ...part, text: messageWithContext }
								: part,
						),
					};
				}

				return { ...msg, content: messageWithContext };
			}
			return msg;
		});

		return chatMessages.filter((msg) => msg.role !== "system");
	}
}
