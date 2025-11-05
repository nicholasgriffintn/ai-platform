import { ConversationManager } from "~/lib/conversationManager";
import { Database } from "~/lib/database";
import { RepositoryManager } from "~/repositories";
import { Embedding } from "~/lib/embedding";
import { MemoryManager } from "~/lib/memory";
import { getModelConfig } from "~/lib/models";
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

const logger = getLogger({ prefix: "lib/chat/preparation/RequestPreparer" });

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

	constructor(private env: any) {
		this.repositories = new RepositoryManager(env);
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

		const { platform = "api", user, anonymousUser, mode = "normal" } = options;

		const isProUser = user?.plan_id === "pro";

		const userSettings = await this.repositories.userSettings.getUserSettings(user?.id);

		const modelConfigs = await this.buildModelConfigs(
			options,
			validationContext,
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
		});

		const finalMessage = await this.processMessageContent(
			options,
			validationContext,
			userSettings,
		);

		await this.storeMessages(
			options,
			conversationManager,
			lastMessage!,
			finalMessage,
			primaryModel,
			platform,
			mode,
		);

		const systemPrompt = await this.buildSystemPrompt(
			options,
			sanitizedMessages!,
			finalMessage,
			primaryModel,
			userSettings,
		);

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
			getModelConfig(model, env),
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
			const embedding = Embedding.getInstance(env, user, userSettings);
			return embedding.augmentPrompt(
				finalUserMessage,
				rag_options,
				env,
				user?.id,
			);
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
	): Promise<string> {
		const {
			system_prompt,
			mode = "normal",
			response_mode,
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
				userSettings,
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
				userSettings,
			);
		}

		const generatedPrompt = await getSystemPrompt(
			{
				completion_id: completion_id!,
				input: finalMessage,
				model: primaryModel,
				date: new Date().toISOString().split("T")[0]!,
				response_mode,
				location,
				mode: currentMode,
			},
			primaryModel,
			user || undefined,
			userSettings,
		);

		return this.enhanceSystemPromptWithMemory(
			generatedPrompt,
			finalMessage,
			user,
			userSettings,
		);
	}

	private async enhanceSystemPromptWithMemory(
		systemPrompt: string,
		finalMessage: string,
		user: any,
		userSettings: any,
	): Promise<string> {
		const isProUser = user?.plan_id === "pro";
		const memoriesEnabled =
			userSettings?.memories_save_enabled ||
			userSettings?.memories_chat_history_enabled;

		if (isProUser && memoriesEnabled && finalMessage) {
			try {
				let memoryContext = "";

				const synthesis = await this.repositories.memorySyntheses.getActiveSynthesis(
					user.id,
					"global",
				);

				if (synthesis) {
					memoryContext += `\n\n# Memory Summary\nThe following is a consolidated summary of your long-term memories about this user:\n<memory_synthesis>\n${synthesis.synthesis_text}\n</memory_synthesis>`;
				}

				const memoryManager = MemoryManager.getInstance(this.env, user);
				const recentMemories = await memoryManager.retrieveMemories(
					finalMessage,
					{
						topK: 3,
						scoreThreshold: 0.5,
					},
				);

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
