import type {
	AnonymousUser,
	Message,
	MessageContent,
	Platform,
	User,
	IEnv,
} from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";
import { getLogger } from "~/utils/logger";
import type { Database } from "./database";
import { RepositoryManager } from "~/repositories";
import { type UsageLimits, UsageManager } from "./usageManager";
import { safeParseJson } from "~/utils/json";
import type { AsyncInvocationMetadata } from "./async/asyncInvocation";
import { isAsyncInvocationPending } from "./async/asyncInvocation";
import { TaskRepository } from "~/repositories/TaskRepository";
import { TaskService } from "~/services/tasks/TaskService";

const logger = getLogger({ prefix: "lib/conversationManager" });

export class ConversationManager {
	private database: Database;
	private model?: string;
	private platform?: Platform;
	private store?: boolean = true;
	private user?: User | null;
	private anonymousUser?: AnonymousUser | null;
	private usageManager?: UsageManager;
	private env?: IEnv;

	private constructor(
		database: Database,
		user?: User | null,
		anonymousUser?: AnonymousUser | null,
		model?: string,
		platform?: Platform,
		store?: boolean,
		env?: IEnv,
	) {
		this.database = database;
		this.user = user;
		this.anonymousUser = anonymousUser;
		this.model = model;
		this.platform = platform || "api";
		this.store = store ?? true;
		this.env = env;

		const repositories = env ? new RepositoryManager(env) : null;
		this.usageManager = repositories
			? new UsageManager(repositories, user, anonymousUser)
			: undefined;
	}

	public static getInstance({
		database,
		user,
		anonymousUser,
		model,
		platform,
		store,
		env,
	}: {
		database: Database;
		user?: User | null;
		anonymousUser?: AnonymousUser | null;
		model?: string;
		platform?: Platform;
		store?: boolean;
		env?: IEnv;
	}): ConversationManager {
		return new ConversationManager(
			database,
			user,
			anonymousUser,
			model,
			platform,
			store ?? true,
			env,
		);
	}

	/**
	 * Get the current usage limits for the user
	 * @returns UsageLimits object or null if no user is set
	 */
	async getUsageLimits(): Promise<UsageLimits | null> {
		if (!this.usageManager) {
			return null;
		}

		try {
			return await this.usageManager.getUsageLimits();
		} catch (error) {
			logger.error("Failed to get usage limits:", {
				error_message: error instanceof Error ? error.message : "Unknown error",
			});
			return null;
		}
	}

	/**
	 * Check usage limits for the current user before generating a response
	 * @param isPro Whether the user is on the pro plan
	 * @param modelId The model ID to check usage for
	 */
	async checkUsageLimits(modelId?: string): Promise<void> {
		if ((this.user || this.anonymousUser) && this.usageManager) {
			const model = modelId || this.model;
			if (model) {
				await this.usageManager.checkUsageByModel(
					model,
					this.user?.plan_id === "pro",
				);
			}
		}
	}

	async incrementFunctionUsage(
		functionType: "premium" | "normal",
		isPro: boolean,
		costPerCall: number,
	): Promise<void> {
		if ((this.user || this.anonymousUser) && this.usageManager) {
			await this.usageManager.incrementFunctionUsage(
				functionType,
				isPro,
				costPerCall,
			);
			return;
		}

		throw new AssistantError(
			"User required to increment function usage",
			ErrorType.PARAMS_ERROR,
		);
	}

	/**
	 * Add a message to a conversation
	 * If the conversation doesn't exist, it will be created
	 * @param conversation_id - The ID of the conversation to add the message to
	 * @param message - The message to add to the conversation
	 * @returns The message that was added to the conversation
	 */
	async add(conversation_id: string, message: Message): Promise<Message> {
		const messages = await this.addBatch(conversation_id, [message]);
		return messages[0];
	}

	/**
	 * Add multiple messages to a conversation in batch
	 * @param conversation_id - The ID of the conversation to add the messages to
	 * @param messages - The messages to add to the conversation
	 * @param options - Optional metadata for conversation creation
	 * @returns The messages that were added to the conversation
	 */
	async addBatch(
		conversation_id: string,
		messages: Message[],
		options?: { metadata?: Record<string, string> },
	): Promise<Message[]> {
		if (!messages.length) return [];

		const newMessages = messages.map((message) => ({
			...message,
			id: message.id || generateId(),
			timestamp: message.timestamp || Date.now(),
			model: message.model || this.model,
			platform: message.platform || this.platform,
		}));

		for (const message of newMessages) {
			if (message.role === "assistant" && this.usageManager) {
				try {
					const modelUsed = message.model || this.model;
					if (modelUsed) {
						await this.usageManager.incrementUsageByModel(modelUsed, true);
						break;
					}
				} catch (error) {
					logger.error("Failed to increment usage:", {
						error_message:
							error instanceof Error ? error.message : "Unknown error",
					});
				}
			}
		}

		if (!this.store) {
			return newMessages;
		}

		if (!this.user?.id) {
			throw new AssistantError(
				"User ID is required to store conversations",
				ErrorType.AUTHENTICATION_ERROR,
			);
		}

		let conversation =
			await this.database.repositories.conversations.getConversation(
				conversation_id,
			);

		if (!conversation) {
			let parentConversationId: string | undefined;
			let parentMessageId: string | undefined;

			if (options?.metadata?.branch_of) {
				try {
					const branchData = safeParseJson(options.metadata.branch_of);
					parentConversationId = branchData.conversation_id;
					parentMessageId = branchData.message_id;
				} catch (error) {
					logger.error("Failed to parse branch_of metadata:", {
						error_message:
							error instanceof Error ? error.message : "Unknown error",
					});
				}
			}

			conversation =
				await this.database.repositories.conversations.createConversation(
					conversation_id,
					this.user?.id,
					"New Conversation",
					{
						parent_conversation_id: parentConversationId,
						parent_message_id: parentMessageId,
					},
				);
		} else if (conversation.user_id !== this.user?.id) {
			throw new AssistantError(
				"You don't have permission to update this conversation",
				ErrorType.FORBIDDEN,
			);
		}

		const createPromises = newMessages.map((message) => {
			let content: string;
			if (typeof message.content === "object") {
				content = JSON.stringify(message.content);
			} else {
				content = message.content || "";
			}

			return this.database.repositories.messages.createMessage(
				message.id as string,
				conversation_id,
				message.role,
				content,
				message,
			);
		});

		await Promise.all(createPromises);

		if (newMessages.length > 0) {
			const lastMessage = newMessages[newMessages.length - 1];
			await this.database.repositories.conversations.updateConversationAfterMessage(
				conversation_id,
				lastMessage.id as string,
			);
		}

		if (this.env?.DB && this.user?.id) {
			for (const message of newMessages) {
				const asyncInvocation = (
					message.data as Record<string, any> | undefined
				)?.asyncInvocation as AsyncInvocationMetadata | undefined;

				if (asyncInvocation && isAsyncInvocationPending(asyncInvocation)) {
					try {
						const taskRepository = new TaskRepository(this.env);
						const taskService = new TaskService(this.env, taskRepository);

						await taskService.enqueueTask({
							task_type: "async_message_polling",
							user_id: this.user.id,
							task_data: {
								conversationId: conversation_id,
								messageId: message.id,
								asyncInvocation,
								userId: this.user.id,
							},
							priority: 7,
						});
					} catch (error) {
						logger.error(
							`Failed to queue async message polling task for message ${message.id}:`,
							error,
						);
					}
				}
			}
		}

		return newMessages;
	}

	/**
	 * Replace all messages in a conversation with new ones, cleaning up any extras
	 * @param conversation_id - The ID of the conversation to replace messages in
	 * @param messages - The messages to set for the conversation
	 */
	async replaceMessages(
		conversation_id: string,
		messages: Message[],
	): Promise<Message[]> {
		if (!this.store) {
			return messages;
		}

		if (!this.user?.id) {
			throw new AssistantError(
				"User ID is required to replace messages",
				ErrorType.AUTHENTICATION_ERROR,
			);
		}

		const conversation =
			await this.database.repositories.conversations.getConversation(
				conversation_id,
			);
		if (conversation && conversation.user_id !== this.user?.id) {
			throw new AssistantError(
				"You don't have permission to update this conversation",
				ErrorType.FORBIDDEN,
			);
		}

		if (conversation) {
			const existingMessages =
				await this.database.repositories.messages.getConversationMessages(
					conversation_id,
				);

			const deletePromises = existingMessages
				.filter((message) => message.id)
				.map((message) =>
					this.database.repositories.messages.deleteMessage(
						message.id as string,
					),
				);

			await Promise.all(deletePromises);
		}

		return await this.addBatch(conversation_id, messages);
	}

	/**
	 * Update existing messages in a conversation
	 * @param conversation_id - The ID of the conversation to update the messages in
	 * @param messages - The messages to update in the conversation
	 */
	async update(conversation_id: string, messages: Message[]): Promise<void> {
		if (!this.store) {
			return;
		}

		if (!this.user?.id) {
			throw new AssistantError(
				"User ID is required to update messages",
				ErrorType.AUTHENTICATION_ERROR,
			);
		}

		const conversation =
			await this.database.repositories.conversations.getConversation(
				conversation_id,
			);
		if (!conversation) {
			throw new AssistantError("Conversation not found", ErrorType.NOT_FOUND);
		}

		if (conversation.user_id !== this.user?.id) {
			throw new AssistantError(
				"You don't have permission to update this conversation",
				ErrorType.FORBIDDEN,
			);
		}

		for (const message of messages) {
			if (!message.id) {
				continue;
			}

			let content: string | undefined;
			if (typeof message.content === "object") {
				content = JSON.stringify(message.content);
			} else {
				content = message.content;
			}

			const updates: Record<string, unknown> = {};
			if (content !== undefined) {
				updates.content = content;
			}

			for (const [key, value] of Object.entries(message)) {
				if (!["id", "content"].includes(key)) {
					updates[key] = value;
				}
			}

			if (Object.keys(updates).length > 0) {
				await this.database.repositories.messages.updateMessage(
					message.id,
					updates,
				);
			}
		}
	}

	/**
	 * Get all messages in a conversation
	 * @param conversation_id - The ID of the conversation to get the messages from
	 * @param message - The message to get from the conversation
	 * @param limit - The number of messages to get
	 * @param after - The message ID to get messages after
	 * @returns The messages that were retrieved from the conversation
	 */
	async get(
		conversation_id: string,
		message?: Message,
		limit?: number,
		after?: string,
	): Promise<Message[]> {
		if (!this.store) {
			return message ? [message] : [];
		}

		if (!this.user?.id) {
			throw new AssistantError(
				"User ID is required to retrieve messages",
				ErrorType.AUTHENTICATION_ERROR,
			);
		}

		const conversation =
			await this.database.repositories.conversations.getConversation(
				conversation_id,
			);
		if (!conversation) {
			throw new AssistantError("Conversation not found", ErrorType.NOT_FOUND);
		}

		if (conversation.user_id !== this.user?.id) {
			throw new AssistantError(
				"You don't have permission to access this conversation",
				ErrorType.FORBIDDEN,
			);
		}

		const messages =
			await this.database.repositories.messages.getConversationMessages(
				conversation_id,
				limit,
				after,
			);

		return messages.map((dbMessage) => this.formatMessage(dbMessage));
	}

	/**
	 * Get a list of conversation IDs
	 * @param limit - The number of conversations to get
	 * @param page - The page number to get
	 * @param includeArchived - Whether to include archived conversations
	 * @returns The conversations that were retrieved from the database
	 */
	async list(
		limit = 25,
		page = 1,
		includeArchived = false,
	): Promise<{
		conversations: Record<string, unknown>[];
		totalPages: number;
		pageNumber: number;
		pageSize: number;
	}> {
		if (!this.user?.id) {
			throw new AssistantError(
				"Manager: User ID is required to list conversations",
				ErrorType.AUTHENTICATION_ERROR,
			);
		}

		const result =
			await this.database.repositories.conversations.getUserConversations(
				this.user?.id,
				limit,
				page,
				includeArchived,
			);

		const conversations = result.conversations.map((conversation) => {
			const messagesString = conversation.messages as string;

			return {
				...conversation,
				messages: messagesString ? messagesString.split(",") : [],
				parent_conversation_id: conversation.parent_conversation_id,
				parent_message_id: conversation.parent_message_id,
			};
		});

		return {
			...result,
			conversations,
		};
	}

	/**
	 * Get conversation details
	 * @param conversation_id - The ID of the conversation to get the details from
	 * @returns The details of the conversation
	 */
	async getConversationDetails(
		conversation_id: string,
	): Promise<Record<string, unknown>> {
		if (!this.user?.id) {
			throw new AssistantError(
				"User ID is required to get conversation details",
				ErrorType.AUTHENTICATION_ERROR,
			);
		}

		const conversation =
			await this.database.repositories.conversations.getConversation(
				conversation_id,
			);
		if (!conversation) {
			throw new AssistantError("Conversation not found", ErrorType.NOT_FOUND);
		}

		if (conversation.user_id !== this.user?.id) {
			throw new AssistantError(
				"You don't have permission to access this conversation",
				ErrorType.FORBIDDEN,
			);
		}

		const dbMessages =
			await this.database.repositories.messages.getConversationMessages(
				conversation.id as string,
			);

		const messages = dbMessages.map((dbMessage) =>
			this.formatMessage(dbMessage),
		);

		return {
			...conversation,
			messages,
		};
	}

	/**
	 * Update conversation properties
	 * @param conversation_id - The ID of the conversation to update
	 * @param updates - The updates to apply to the conversation
	 * @returns The updated conversation
	 */
	async updateConversation(
		conversation_id: string,
		updates: {
			title?: string;
			archived?: boolean;
		},
	): Promise<Record<string, unknown>> {
		if (!this.store) {
			return {};
		}

		if (!this.user?.id) {
			throw new AssistantError(
				"User ID is required to update a conversation",
				ErrorType.AUTHENTICATION_ERROR,
			);
		}

		const conversation =
			await this.database.repositories.conversations.getConversation(
				conversation_id,
			);
		if (!conversation) {
			throw new AssistantError("Conversation not found", ErrorType.NOT_FOUND);
		}

		if (conversation.user_id !== this.user?.id) {
			throw new AssistantError(
				"You don't have permission to update this conversation",
				ErrorType.FORBIDDEN,
			);
		}

		const updateObj: Record<string, unknown> = {};

		if (updates.title !== undefined) {
			updateObj.title = updates.title;
		}

		if (updates.archived !== undefined) {
			updateObj.is_archived = updates.archived;
		}

		await this.database.repositories.conversations.updateConversation(
			conversation_id,
			updateObj,
		);

		const updatedConversation =
			await this.database.repositories.conversations.getConversation(
				conversation_id,
			);
		return updatedConversation || {};
	}

	/**
	 * Get a message by its ID
	 * @param message_id - The ID of the message to get
	 * @returns The message that was retrieved from the database
	 */
	async getMessageById(
		message_id: string,
	): Promise<{ message: Message; conversation_id: string }> {
		if (!this.user?.id) {
			throw new AssistantError(
				"User ID is required to retrieve a message",
				ErrorType.AUTHENTICATION_ERROR,
			);
		}

		const result =
			await this.database.repositories.messages.getMessageById(message_id);

		if (!result) {
			throw new AssistantError("Message not found", ErrorType.NOT_FOUND);
		}

		if (result.user_id !== this.user?.id) {
			throw new AssistantError(
				"You don't have permission to access this message",
				ErrorType.FORBIDDEN,
			);
		}

		const message = this.formatMessage(result.message);

		return {
			message,
			conversation_id: result.conversation_id,
		};
	}

	/**
	 * Format a database message record into a Message object
	 * @param dbMessage - The database message record to format
	 * @returns The formatted Message object
	 */
	private formatMessage(dbMessage: Record<string, unknown>): Message {
		let content: string | MessageContent[] = dbMessage.content as string;

		try {
			if (
				typeof content === "string" &&
				(content.startsWith("[") || content.startsWith("{"))
			) {
				const parsed = safeParseJson(content);
				content = parsed;
			}
		} catch (e) {
			logger.error("Error parsing message content", { error: e });
		}

		let toolCalls = dbMessage.tool_calls;
		if (dbMessage.tool_calls) {
			toolCalls = safeParseJson(dbMessage.tool_calls as string);
		}

		let citations = dbMessage.citations;
		if (dbMessage.citations) {
			citations = safeParseJson(dbMessage.citations as string);
		}

		let parsedData = dbMessage.data;
		if (dbMessage.data) {
			parsedData = safeParseJson(dbMessage.data as string);
		}

		return {
			...dbMessage,
			id: dbMessage.id,
			role: dbMessage.role as string,
			content,
			model: dbMessage.model as string,
			name: dbMessage.name as string,
			tool_calls: toolCalls,
			citations,
			status: dbMessage.status as string,
			timestamp: dbMessage.timestamp as number,
			platform: dbMessage.platform as string,
			mode: dbMessage.mode as string,
			data: parsedData,
			usage: dbMessage.usage
				? safeParseJson(dbMessage.usage as string)
				: undefined,
			log_id: dbMessage.log_id as string,
		} as Message;
	}

	/**
	 * Generate a unique ID for sharing a conversation
	 * @returns The unique ID for sharing a conversation
	 */
	generateShareId(): string {
		return generateId();
	}

	/**
	 * Make a conversation public by setting is_public to true and generating a share_id
	 * @param conversation_id - The ID of the conversation to share
	 * @returns The share_id for the conversation
	 */
	async shareConversation(
		conversation_id: string,
	): Promise<{ share_id: string }> {
		if (!this.user?.id) {
			throw new AssistantError(
				"User ID is required to share conversations",
				ErrorType.AUTHENTICATION_ERROR,
			);
		}

		const conversation =
			await this.database.repositories.conversations.getConversation(
				conversation_id,
			);

		if (!conversation) {
			throw new AssistantError("Conversation not found", ErrorType.NOT_FOUND);
		}

		if (conversation.user_id !== this.user?.id) {
			throw new AssistantError(
				"You don't have permission to share this conversation",
				ErrorType.FORBIDDEN,
			);
		}

		const share_id =
			(conversation.share_id as string) || this.generateShareId();

		const updatedConversation =
			await this.database.repositories.conversations.updateConversation(
				conversation_id,
				{
					is_public: 1,
					share_id,
				},
			);

		if (!updatedConversation) {
			throw new AssistantError(
				"Failed to share conversation",
				ErrorType.UNKNOWN_ERROR,
			);
		}

		return { share_id };
	}

	/**
	 * Make a conversation private by setting is_public to false
	 * @param conversation_id - The ID of the conversation to unshare
	 */
	async unshareConversation(conversation_id: string): Promise<void> {
		if (!this.user?.id) {
			throw new AssistantError(
				"User ID is required to unshare conversations",
				ErrorType.AUTHENTICATION_ERROR,
			);
		}

		const conversation =
			await this.database.repositories.conversations.getConversation(
				conversation_id,
			);

		if (!conversation) {
			throw new AssistantError("Conversation not found", ErrorType.NOT_FOUND);
		}

		if (conversation.user_id !== this.user?.id) {
			throw new AssistantError(
				"You don't have permission to unshare this conversation",
				ErrorType.FORBIDDEN,
			);
		}

		const updatedConversation =
			await this.database.repositories.conversations.updateConversation(
				conversation_id,
				{
					is_public: 0,
				},
			);

		if (!updatedConversation) {
			throw new AssistantError(
				"Failed to unshare conversation",
				ErrorType.UNKNOWN_ERROR,
			);
		}
	}

	/**
	 * Get a publicly shared conversation by its share_id without requiring authentication
	 * @param share_id - The share_id of the conversation to get
	 * @param limit - The number of messages to get
	 * @param after - The message ID to get messages after
	 * @returns The messages that were retrieved from the conversation
	 */
	async getPublicConversation(
		share_id: string,
		limit = 50,
		after?: string,
	): Promise<Message[]> {
		const conversation =
			await this.database.repositories.conversations.getConversationByShareId(
				share_id,
			);

		if (!conversation) {
			throw new AssistantError(
				"Shared conversation not found",
				ErrorType.NOT_FOUND,
			);
		}

		if (!conversation.is_public) {
			throw new AssistantError(
				"This conversation is not publicly shared",
				ErrorType.FORBIDDEN,
			);
		}

		const messages = await this.database.repositories.messages.getMessages(
			conversation.id as string,
			limit,
			after,
		);
		return messages.map((message) => this.formatMessage(message));
	}

	async deleteAllChatCompletions(user_id: number): Promise<void> {
		if (!user_id) {
			throw new AssistantError(
				"User ID is required to delete all chat completions",
				ErrorType.AUTHENTICATION_ERROR,
			);
		}

		await this.database.deleteAllChatCompletions(user_id);
	}
}
