import type { ConversationType } from "@ngriffin_uk/polychat-schemas";

import type { RepositoryManager } from "~/repositories";
import type {
  ConversationArchiveFilter,
  ConversationSortBy,
  SetConversationsArchivedOptions,
} from "~/repositories/ConversationRepository";
import { TaskRepository } from "~/repositories/TaskRepository";
import { TaskService } from "~/services/tasks/TaskService";
import type { AnonymousUser, Message, Platform, User, IEnv } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";
import { safeParseJson } from "~/utils/json";
import { getLogger } from "~/utils/logger";

import type { AsyncInvocationMetadata } from "./async/asyncInvocation";
import { isAsyncInvocationPending } from "./async/asyncInvocation";
import { normaliseMessageTimestampsForStorage } from "./chat/messages/ordering";
import {
  buildMessageParts,
  hasSnapshotPart,
  isCompactionMarkerMessage,
  normaliseMessageParts,
} from "./chat/messages/parts";
import { createInitialConversationTitle } from "./conversation/title-source";
import { loadVisibleConversationMessagePage } from "./conversation/visibleMessagePagination";
import type { Database } from "./database";
import { hasPlanEntitlement } from "./plans";
import { type UsageLimits, UsageManager } from "./usageManager";

const logger = getLogger({ prefix: "lib/conversationManager" });

export interface ConversationListOptions {
  archiveFilter?: ConversationArchiveFilter;
  limit?: number;
  page?: number;
  query?: string;
  sortBy?: ConversationSortBy;
  updatedAfter?: string;
}

export interface ConversationDetails extends Record<string, unknown> {
  messages: Message[];
  project_id?: string | null;
}

interface ConversationWriteOptions {
  metadata?: Record<string, string>;
  type?: ConversationType;
}

export class ConversationManager {
  private database: Database;
  private model?: string;
  private provider?: string;
  private platform?: Platform;
  private store?: boolean = true;
  private user?: User | null;
  private anonymousUser?: AnonymousUser | null;
  private usageManager?: UsageManager;
  private env?: IEnv;
  private requestCache?: Map<string, unknown>;
  private taskService?: TaskService;
  private repositories?: RepositoryManager;

  private constructor(
    database: Database,
    user?: User | null,
    anonymousUser?: AnonymousUser | null,
    model?: string,
    provider?: string,
    platform?: Platform,
    store?: boolean,
    env?: IEnv,
    requestCache?: Map<string, unknown>,
    repositories?: RepositoryManager,
  ) {
    this.database = database;
    this.user = user;
    this.anonymousUser = anonymousUser;
    this.model = model;
    this.provider = provider;
    this.platform = platform || "api";
    this.store = store ?? true;
    this.env = env;
    this.requestCache = requestCache;
    this.repositories = repositories ?? database.repositories;
    const resolvedRepositories = this.repositories;

    if (env?.DB) {
      this.taskService = new TaskService(env, new TaskRepository(env));
    }

    this.usageManager = resolvedRepositories
      ? new UsageManager(resolvedRepositories, user ?? null, anonymousUser ?? null)
      : undefined;
  }

  public static getInstance({
    database,
    user,
    anonymousUser,
    model,
    provider,
    platform,
    store,
    env,
    requestCache,
    repositories,
  }: {
    database: Database;
    user?: User | null;
    anonymousUser?: AnonymousUser | null;
    model?: string;
    provider?: string;
    platform?: Platform;
    store?: boolean;
    env?: IEnv;
    requestCache?: Map<string, unknown>;
    repositories?: RepositoryManager;
  }): ConversationManager {
    return new ConversationManager(
      database,
      user,
      anonymousUser,
      model,
      provider,
      platform,
      store ?? true,
      env,
      requestCache,
      repositories,
    );
  }

  private prepareMessagesForStorage(messages: Message[]): Message[] {
    const orderedMessages = normaliseMessageTimestampsForStorage(messages);
    const messagesWithDefaults = orderedMessages.map((message) => ({
      ...message,
      id: message.id || generateId(),
      model: message.model || this.model,
      platform: message.platform || this.platform,
    }));

    return messagesWithDefaults.map((message) => {
      const normalisedParts = normaliseMessageParts(message.parts, message.timestamp);

      if (normalisedParts && normalisedParts.length > 0) {
        return { ...message, parts: normalisedParts };
      }

      const derivedParts = buildMessageParts({
        ...message,
        parts: undefined,
      });

      return {
        ...message,
        parts: derivedParts,
      };
    });
  }

  private dedupeMessagesForReplacement(messages: Message[]): Message[] {
    const seenIds = new Set<string>();
    const dedupedMessages: Message[] = [];

    for (let index = messages.length - 1; index >= 0; index--) {
      const message = messages[index];
      const messageId = message.id;

      if (!messageId || seenIds.has(messageId)) {
        continue;
      }

      seenIds.add(messageId);
      dedupedMessages.unshift(message);
    }

    return dedupedMessages;
  }

  private async incrementUsageForAssistantResponse(messages: Message[]): Promise<void> {
    for (const message of messages) {
      if (
        message.role === "assistant" &&
        !hasSnapshotPart(message) &&
        !isCompactionMarkerMessage(message) &&
        this.usageManager
      ) {
        try {
          await this.usageManager.incrementUsage();
          break;
        } catch (error) {
          logger.error("Failed to increment usage:", {
            error_message: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }
    }
  }

  private getBranchParentIds(options?: ConversationWriteOptions): {
    parentConversationId?: string;
    parentMessageId?: string;
  } {
    if (!options?.metadata?.branch_of) {
      return {};
    }

    try {
      const branchData =
        safeParseJson<{
          conversation_id?: unknown;
          message_id?: unknown;
        }>(options.metadata.branch_of) ?? {};

      return {
        parentConversationId:
          typeof branchData.conversation_id === "string" ? branchData.conversation_id : undefined,
        parentMessageId:
          typeof branchData.message_id === "string" ? branchData.message_id : undefined,
      };
    } catch (error) {
      logger.error("Failed to parse branch_of metadata:", {
        error_message: error instanceof Error ? error.message : "Unknown error",
      });

      return {};
    }
  }

  private async ensureWritableConversation(
    conversation_id: string,
    authErrorMessage: string,
    options?: ConversationWriteOptions,
    initialMessages: Message[] = [],
  ): Promise<Record<string, unknown> | null> {
    if (!this.user?.id) {
      throw new AssistantError(authErrorMessage, ErrorType.AUTHENTICATION_ERROR);
    }

    const conversation =
      await this.database.repositories.conversations.getConversation(conversation_id);

    if (!conversation) {
      const { parentConversationId, parentMessageId } = this.getBranchParentIds(options);
      const projectId = options?.metadata?.project_id;

      if (projectId) {
        const project = await this.repositories?.workspaces.getProject(projectId);
        const membership = project
          ? await this.repositories?.workspaces.getMembership(project.workspace_id, this.user.id)
          : null;

        if (!project || !membership) {
          throw new AssistantError(
            "You don't have access to this project",
            ErrorType.FORBIDDEN,
            403,
          );
        }
      }

      return await this.database.repositories.conversations.createConversation(
        conversation_id,
        this.user.id,
        createInitialConversationTitle(initialMessages),
        {
          parent_conversation_id: parentConversationId,
          parent_message_id: parentMessageId,
          project_id: projectId,
          type: options?.type,
        },
      );
    }

    if (!(await this.canAccessConversation(conversation))) {
      throw new AssistantError(
        "You don't have permission to update this conversation",
        ErrorType.FORBIDDEN,
      );
    }

    return conversation;
  }

  private async canAccessConversation(conversation: Record<string, unknown>): Promise<boolean> {
    if (!this.user?.id) {
      return false;
    }

    if (!conversation.project_id) {
      return conversation.user_id === this.user.id;
    }

    if (!hasPlanEntitlement(this.user.plan_id, "pro")) {
      return false;
    }

    if (typeof conversation.id !== "string") {
      return false;
    }

    return (
      (await this.repositories?.workspaces.canAccessConversation(conversation.id, this.user.id)) ??
      false
    );
  }

  private async enqueueAsyncInvocationTasks(
    conversation_id: string,
    messages: Message[],
  ): Promise<void> {
    if (!this.taskService || !this.user?.id) {
      return;
    }

    for (const message of messages) {
      const asyncInvocation = (message.data as Record<string, any> | undefined)?.asyncInvocation as
        | AsyncInvocationMetadata
        | undefined;

      if (asyncInvocation && isAsyncInvocationPending(asyncInvocation)) {
        try {
          await this.taskService.enqueueTask({
            task_type: "async_message_polling",
            user_id: this.user.id,
            task_data: {
              conversationId: conversation_id,
              messageId: message.id,
              asyncInvocation,
              userId: this.user.id,
              pollAttempt: 0,
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

  /** Check the free-account abuse guard before starting provider work. */
  async checkUsageLimits(): Promise<void> {
    if ((this.user || this.anonymousUser) && this.usageManager) {
      await this.usageManager.checkUsage();
    }
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
    options?: ConversationWriteOptions,
  ): Promise<Message[]> {
    if (!messages.length) {
      return [];
    }

    const normalisedMessages = this.prepareMessagesForStorage(messages);

    await this.incrementUsageForAssistantResponse(normalisedMessages);

    if (!this.store) {
      return normalisedMessages;
    }

    await this.ensureWritableConversation(
      conversation_id,
      "User ID is required to store conversations",
      options,
      normalisedMessages,
    );

    if (normalisedMessages.length > 0) {
      await this.database.repositories.messages.createMessagesAndUpdateConversation(
        conversation_id,
        normalisedMessages.map((message) => ({
          id: message.id,
          role: message.role,
          content: this.serializeMessageContent(message.content),
          data: message,
        })),
      );
    }

    await this.enqueueAsyncInvocationTasks(conversation_id, normalisedMessages);

    return normalisedMessages;
  }

  /**
   * Replace all messages in a conversation with new ones, cleaning up any extras
   * @param conversation_id - The ID of the conversation to replace messages in
   * @param messages - The messages to set for the conversation
   */
  async replaceMessages(
    conversation_id: string,
    messages: Message[],
    options?: ConversationWriteOptions,
  ): Promise<Message[]> {
    const normalisedMessages = this.dedupeMessagesForReplacement(
      this.prepareMessagesForStorage(messages),
    );

    if (!this.store) {
      return normalisedMessages;
    }

    await this.ensureWritableConversation(
      conversation_id,
      "User ID is required to replace messages",
      options,
      normalisedMessages,
    );

    const messageIds = normalisedMessages.map((message) => message.id);
    const foreignCount =
      await this.database.repositories.messages.countMessagesOwnedByOtherConversations(
        conversation_id,
        messageIds,
      );

    if (foreignCount > 0) {
      throw new AssistantError(
        "Unable to replace messages because one or more message IDs already belong to another conversation",
        ErrorType.PARAMS_ERROR,
      );
    }

    const lastMessage = normalisedMessages.at(-1);

    const replaced = await this.database.repositories.messages.replaceConversationMessages(
      conversation_id,
      normalisedMessages.map((message) => ({
        id: message.id,
        role: message.role,
        content: this.serializeMessageContent(message.content),
        data: message,
      })),
      {
        last_message_id: lastMessage?.id ?? null,
        last_message_at: lastMessage ? new Date().toISOString() : null,
        message_count: normalisedMessages.length,
      },
    );

    if (!replaced) {
      throw new AssistantError(
        "Unable to replace messages because one or more message IDs already belong to another conversation",
        ErrorType.PARAMS_ERROR,
      );
    }

    await this.enqueueAsyncInvocationTasks(conversation_id, normalisedMessages);

    return normalisedMessages;
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
      await this.database.repositories.conversations.getConversation(conversation_id);

    if (!conversation) {
      throw new AssistantError("Conversation not found", ErrorType.NOT_FOUND);
    }

    if (!(await this.canAccessConversation(conversation))) {
      throw new AssistantError(
        "You don't have permission to update this conversation",
        ErrorType.FORBIDDEN,
      );
    }

    for (const message of messages) {
      if (!message.id) {
        continue;
      }

      const updates: Record<string, unknown> = {};

      if (message.content !== undefined) {
        updates.content = this.serializeMessageContent(message.content);
      }

      if (Array.isArray(message.parts)) {
        updates.parts = normaliseMessageParts(message.parts, message.timestamp) || [];
      }

      for (const [key, value] of Object.entries(message)) {
        if (!["id", "content", "parts"].includes(key)) {
          updates[key] = value;
        }
      }

      if (Object.keys(updates).length > 0) {
        await this.database.repositories.messages.updateMessage(
          conversation_id,
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
    options?: {
      includeArchived?: boolean;
    },
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
      await this.database.repositories.conversations.getConversation(conversation_id);

    if (!conversation) {
      throw new AssistantError("Conversation not found", ErrorType.NOT_FOUND);
    }

    if (!(await this.canAccessConversation(conversation))) {
      throw new AssistantError(
        "You don't have permission to access this conversation",
        ErrorType.FORBIDDEN,
      );
    }

    const messages = await this.database.repositories.messages.getConversationMessages(
      conversation_id,
      limit ?? 0,
      after,
      {
        includeArchived: options?.includeArchived ?? false,
      },
    );

    return messages.map((dbMessage) => this.formatMessage(dbMessage));
  }

  async getVisibleMessages(
    conversation_id: string,
    limit = 50,
    after?: string,
    options: { includeArchived?: boolean; includeSnapshots?: boolean } = {},
  ): Promise<Message[]> {
    if (!this.store) {
      return [];
    }

    if (!this.user?.id) {
      throw new AssistantError(
        "User ID is required to retrieve messages",
        ErrorType.AUTHENTICATION_ERROR,
      );
    }

    const conversation =
      await this.database.repositories.conversations.getConversation(conversation_id);

    if (!conversation) {
      throw new AssistantError("Conversation not found", ErrorType.NOT_FOUND);
    }

    if (!(await this.canAccessConversation(conversation))) {
      throw new AssistantError(
        "You don't have permission to access this conversation",
        ErrorType.FORBIDDEN,
      );
    }

    return loadVisibleConversationMessagePage({
      conversationId: conversation_id,
      limit,
      after,
      includeArchived: options.includeArchived ?? true,
      loadMessages: (conversationId, pageLimit, cursor, pageOptions) =>
        this.database.repositories.messages.getConversationMessages(
          conversationId,
          pageLimit,
          cursor,
          pageOptions,
        ),
      formatMessage: (message) => this.formatMessage(message),
      isHiddenMessage: (message) => !options.includeSnapshots && hasSnapshotPart(message),
    });
  }

  async getAllMessages(
    conversation_id: string,
    options?: {
      includeArchived?: boolean;
    },
  ): Promise<Message[]> {
    return this.get(conversation_id, undefined, 0, undefined, options);
  }

  async archiveMessages(conversation_id: string, messageIds: string[]): Promise<void> {
    if (!this.store || messageIds.length === 0) {
      return;
    }

    if (!this.user?.id) {
      throw new AssistantError(
        "User ID is required to archive messages",
        ErrorType.AUTHENTICATION_ERROR,
      );
    }

    const conversation =
      await this.database.repositories.conversations.getConversation(conversation_id);

    if (!conversation) {
      throw new AssistantError("Conversation not found", ErrorType.NOT_FOUND);
    }

    if (!(await this.canAccessConversation(conversation))) {
      throw new AssistantError(
        "You don't have permission to archive messages in this conversation",
        ErrorType.FORBIDDEN,
      );
    }

    await this.database.repositories.messages.archiveMessages(conversation_id, messageIds);
    await this.refreshConversationMessageMetadata(conversation_id);
  }

  async deleteMessages(conversation_id: string, messageIds: string[]): Promise<void> {
    if (!this.store || messageIds.length === 0) {
      return;
    }

    if (!this.user?.id) {
      throw new AssistantError(
        "User ID is required to delete messages",
        ErrorType.AUTHENTICATION_ERROR,
      );
    }

    const conversation =
      await this.database.repositories.conversations.getConversation(conversation_id);

    if (!conversation) {
      throw new AssistantError("Conversation not found", ErrorType.NOT_FOUND);
    }

    if (!(await this.canAccessConversation(conversation))) {
      throw new AssistantError(
        "You don't have permission to delete messages in this conversation",
        ErrorType.FORBIDDEN,
      );
    }

    await this.database.repositories.messages.deleteMessages(conversation_id, messageIds);
    await this.refreshConversationMessageMetadata(conversation_id);
  }

  private async refreshConversationMessageMetadata(conversation_id: string): Promise<void> {
    const metadata =
      await this.database.repositories.messages.getConversationMessageMetadata(conversation_id);

    await this.database.repositories.conversations.updateConversation(conversation_id, {
      last_message_id: metadata.last_message_id,
      last_message_at: metadata.last_message_id ? new Date().toISOString() : null,
      message_count: metadata.message_count,
    });
  }

  /**
   * Get a list of conversation IDs
   * @param limit - The number of conversations to get
   * @param page - The page number to get
   * @param includeArchived - Whether to include archived conversations
   * @returns The conversations that were retrieved from the database
   */
  async list(options: ConversationListOptions = {}): Promise<{
    conversations: Record<string, unknown>[];
    total: number;
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

    const {
      archiveFilter = "active",
      limit = 25,
      page = 1,
      query,
      sortBy = "updated",
      updatedAfter,
    } = options;

    const result = await this.database.repositories.conversations.getUserConversations(
      this.user?.id,
      {
        archiveFilter,
        limit,
        page,
        query,
        sortBy,
        updatedAfter,
      },
    );

    return result;
  }

  async setArchivedForAll(options: SetConversationsArchivedOptions): Promise<number> {
    if (!this.user?.id) {
      throw new AssistantError(
        "Manager: User ID is required to archive conversations",
        ErrorType.AUTHENTICATION_ERROR,
      );
    }

    return await this.database.repositories.conversations.setPersonalConversationsArchived(
      this.user.id,
      options,
    );
  }

  async getConversationMetadata(conversation_id: string): Promise<Record<string, unknown>> {
    if (!this.user?.id) {
      throw new AssistantError(
        "User ID is required to get conversation details",
        ErrorType.AUTHENTICATION_ERROR,
      );
    }

    const conversation =
      await this.database.repositories.conversations.getConversation(conversation_id);

    if (!conversation) {
      throw new AssistantError("Conversation not found", ErrorType.NOT_FOUND);
    }

    if (!(await this.canAccessConversation(conversation))) {
      throw new AssistantError(
        "You don't have permission to access this conversation",
        ErrorType.FORBIDDEN,
      );
    }

    return conversation;
  }

  /**
   * Get conversation details
   * @param conversation_id - The ID of the conversation to get the details from
   * @returns The details of the conversation
   */
  async getConversationDetails(
    conversation_id: string,
    options: { includeArchived?: boolean; includeSnapshots?: boolean } = {},
  ): Promise<ConversationDetails> {
    const conversation = await this.getConversationMetadata(conversation_id);

    const storedConversationId =
      typeof conversation.id === "string" ? conversation.id : conversation_id;
    const dbMessages = await this.database.repositories.messages.getConversationMessages(
      storedConversationId,
      0,
      undefined,
      {
        includeArchived: options.includeArchived ?? true,
      },
    );

    const messages = dbMessages
      .map((dbMessage) => this.formatMessage(dbMessage))
      .filter((message) => options.includeSnapshots || !hasSnapshotPart(message));

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
      await this.database.repositories.conversations.getConversation(conversation_id);

    if (!conversation) {
      throw new AssistantError("Conversation not found", ErrorType.NOT_FOUND);
    }

    if (!(await this.canAccessConversation(conversation))) {
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

    await this.database.repositories.conversations.updateConversation(conversation_id, updateObj);

    const updatedConversation =
      await this.database.repositories.conversations.getConversation(conversation_id);

    return updatedConversation || {};
  }

  /**
   * Get a message by its ID
   * @param message_id - The ID of the message to get
   * @returns The message that was retrieved from the database
   */
  async getMessageById(message_id: string): Promise<{ message: Message; conversation_id: string }> {
    if (!this.user?.id) {
      throw new AssistantError(
        "User ID is required to retrieve a message",
        ErrorType.AUTHENTICATION_ERROR,
      );
    }

    const result = await this.database.repositories.messages.getMessageById(message_id);

    if (!result) {
      throw new AssistantError("Message not found", ErrorType.NOT_FOUND);
    }

    if (
      !(await this.repositories?.workspaces.canAccessConversation(
        result.conversation_id,
        this.user.id,
      ))
    ) {
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
    let content: Message["content"] = dbMessage.content as Message["content"];

    try {
      if (typeof content === "string" && (content.startsWith("[") || content.startsWith("{"))) {
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

    let parsedParts = dbMessage.parts;

    if (dbMessage.parts) {
      parsedParts = safeParseJson(dbMessage.parts as string);
    }

    const normalisedParts = normaliseMessageParts(
      parsedParts,
      dbMessage.timestamp as number | undefined,
    );

    const formattedMessage = {
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
      parts: normalisedParts,
      usage: dbMessage.usage ? safeParseJson(dbMessage.usage as string) : undefined,
      log_id: dbMessage.log_id as string,
    } as Message;

    if (!formattedMessage.parts || formattedMessage.parts.length === 0) {
      formattedMessage.parts = buildMessageParts(formattedMessage);
    }

    return formattedMessage;
  }

  private serializeMessageContent(messageContent: Message["content"]): string {
    if (typeof messageContent === "object") {
      return JSON.stringify(messageContent);
    }

    return messageContent || "";
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
  async shareConversation(conversation_id: string): Promise<{ share_id: string }> {
    if (!this.user?.id) {
      throw new AssistantError(
        "User ID is required to share conversations",
        ErrorType.AUTHENTICATION_ERROR,
      );
    }

    const conversation =
      await this.database.repositories.conversations.getConversation(conversation_id);

    if (!conversation) {
      throw new AssistantError("Conversation not found", ErrorType.NOT_FOUND);
    }

    if (!(await this.canAccessConversation(conversation))) {
      throw new AssistantError(
        "You don't have permission to share this conversation",
        ErrorType.FORBIDDEN,
      );
    }

    if (conversation.project_id) {
      throw new AssistantError(
        "Project conversations cannot be shared publicly",
        ErrorType.FORBIDDEN,
        403,
      );
    }

    const share_id = (conversation.share_id as string) || this.generateShareId();

    const updatedConversation = await this.database.repositories.conversations.updateConversation(
      conversation_id,
      {
        is_public: 1,
        share_id,
      },
    );

    if (!updatedConversation) {
      throw new AssistantError("Failed to share conversation", ErrorType.UNKNOWN_ERROR);
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
      await this.database.repositories.conversations.getConversation(conversation_id);

    if (!conversation) {
      throw new AssistantError("Conversation not found", ErrorType.NOT_FOUND);
    }

    if (!(await this.canAccessConversation(conversation))) {
      throw new AssistantError(
        "You don't have permission to unshare this conversation",
        ErrorType.FORBIDDEN,
      );
    }

    const updatedConversation = await this.database.repositories.conversations.updateConversation(
      conversation_id,
      {
        is_public: 0,
      },
    );

    if (!updatedConversation) {
      throw new AssistantError("Failed to unshare conversation", ErrorType.UNKNOWN_ERROR);
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
    options?: {
      includeArchived?: boolean;
    },
  ): Promise<Message[]> {
    const conversation =
      await this.database.repositories.conversations.getConversationByShareId(share_id);

    if (!conversation || conversation.project_id) {
      throw new AssistantError("Shared conversation not found", ErrorType.NOT_FOUND);
    }

    if (!conversation.is_public) {
      throw new AssistantError("This conversation is not publicly shared", ErrorType.FORBIDDEN);
    }

    const includeArchived = options?.includeArchived ?? false;

    return loadVisibleConversationMessagePage({
      conversationId: conversation.id as string,
      limit,
      after,
      includeArchived,
      loadMessages: (conversationId, pageLimit, cursor, pageOptions) =>
        this.database.repositories.messages.getMessages(
          conversationId,
          pageLimit,
          cursor,
          pageOptions,
        ),
      formatMessage: (message) => this.formatMessage(message),
      isHiddenMessage: hasSnapshotPart,
    });
  }
}
