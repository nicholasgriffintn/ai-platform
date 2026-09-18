import {
  hasPlanEntitlement,
  type CreditActor,
  type TurnReservation,
} from "@ngriffin_uk/polychat-ai-billing";
import {
  isAsyncInvocationPending,
  type AsyncInvocationMetadata,
} from "@ngriffin_uk/polychat-ai-providers";
import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import type { ConversationType, ModelTier, PermissionMode } from "@ngriffin_uk/polychat-schemas";
import { permissionModeSchema } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { generateId } from "@ngriffin_uk/polychat-utility-server/id";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";

import type { Database } from "~/infrastructure/database";
import type { RepositoryManager } from "~/infrastructure/database/repositoryManager";
import { normaliseMessageTimestampsForStorage } from "~/modules/chat/application/messages/ordering";
import {
  buildMessageParts,
  hasSnapshotPart,
  isCompactionMarkerMessage,
  normaliseMessageParts,
} from "~/modules/chat/application/messages/parts";
import {
  getPublicConversation,
  shareConversation,
  unshareConversation,
  type ConversationSharingScope,
} from "~/modules/conversations/application/sharing";
import { formatStoredMessage } from "~/modules/conversations/application/stored-message";
import { createInitialConversationTitle } from "~/modules/conversations/application/title-source";
import {
  assertTurnAdmitted,
  resolveCreditActor,
  resolveTurnAdmission,
  type DurableTurnReservation,
  type TurnAdmissionRequest,
  type TurnAdmissionScope,
} from "~/modules/conversations/application/turn-admission";
import { loadVisibleConversationMessagePage } from "~/modules/conversations/application/visibleMessagePagination";
import type { ConversationWriteFence } from "~/modules/conversations/application/write-fence";
import type {
  ConversationArchiveFilter,
  ConversationSortBy,
  SetConversationsArchivedOptions,
} from "~/modules/conversations/infrastructure/ConversationRepository";
import { TaskService } from "~/modules/tasks/application/TaskService";
import { TaskRepository } from "~/modules/tasks/infrastructure/TaskRepository";
import { type UsageLimits, UsageManager } from "~/modules/usage/application/usageManager";
import type { AnonymousUser, Message, Platform, User, IEnv } from "~/types";

const logger = getLogger({ prefix: "services/conversations/manager" });

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
  model_id?: string | null;
  model_tier?: ModelTier | null;
  permission_mode?: PermissionMode;
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
  private pendingTurnReservation?: TurnReservation;
  private writeFence?: ConversationWriteFence;
  private runId?: string;
  private durableTurnReservation?: DurableTurnReservation;

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
    writeFence?: ConversationWriteFence,
    runId?: string,
    durableTurnReservation?: DurableTurnReservation,
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
    this.writeFence = writeFence;
    this.runId = runId;
    this.durableTurnReservation = durableTurnReservation;
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
    writeFence,
    runId,
    durableTurnReservation,
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
    writeFence?: ConversationWriteFence;
    runId?: string;
    durableTurnReservation?: DurableTurnReservation;
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
      writeFence,
      runId,
      durableTurnReservation,
    );
  }

  private async assertWriteOwnership(): Promise<void> {
    await this.writeFence?.assertOwned();
  }

  private prepareMessagesForStorage(messages: Message[]): Message[] {
    const orderedMessages = normaliseMessageTimestampsForStorage(messages);
    const messagesWithDefaults = orderedMessages.map((message) => ({
      ...message,
      id: message.id || generateId(),
      model: message.model || this.model,
      platform: message.platform || this.platform,
      run_id: message.run_id || this.runId,
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

  private async getInheritedPermissionMode(
    parentConversationId?: string,
  ): Promise<PermissionMode | undefined> {
    if (!parentConversationId) {
      return undefined;
    }

    const parent =
      await this.database.repositories.conversations.getConversation(parentConversationId);
    const parsed = permissionModeSchema.safeParse(parent?.permission_mode);

    return parsed.success ? parsed.data : undefined;
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

      await this.assertWriteOwnership();

      const permissionMode =
        options?.permission_mode ??
        (await this.getInheritedPermissionMode(parentConversationId)) ??
        undefined;

      return await this.database.repositories.conversations.createConversation(
        conversation_id,
        this.user.id,
        createInitialConversationTitle(initialMessages),
        {
          parent_conversation_id: parentConversationId,
          parent_message_id: parentMessageId,
          project_id: projectId,
          type: options?.type,
          model_id: options?.model_id,
          model_tier: options?.model_tier,
          permission_mode: permissionMode,
        },
      );
    }

    if (!(await this.canAccessConversation(conversation))) {
      throw new AssistantError(
        "You don't have permission to update this conversation",
        ErrorType.FORBIDDEN,
      );
    }

    const selectionUpdates: Record<string, unknown> = {};

    if (options?.model_id !== undefined) {
      selectionUpdates.model_id = options.model_id;
    }

    if (options?.model_tier !== undefined) {
      selectionUpdates.model_tier = options.model_tier;
    }

    if (options?.permission_mode !== undefined) {
      selectionUpdates.permission_mode = options.permission_mode;
    }

    if (Object.keys(selectionUpdates).length > 0) {
      await this.assertWriteOwnership();
      await this.database.repositories.conversations.updateConversation(
        conversation_id,
        selectionUpdates,
      );

      return { ...conversation, ...selectionUpdates };
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
          await this.assertWriteOwnership();
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

  creditActor(): CreditActor | null {
    return resolveCreditActor(this.turnAdmissionScope());
  }

  private turnAdmissionScope(): TurnAdmissionScope {
    return {
      env: this.env,
      repositories: this.repositories,
      user: this.user,
      anonymousUser: this.anonymousUser,
      provider: this.provider,
      durableTurnReservation: this.durableTurnReservation,
    };
  }

  async admitTurn(params: TurnAdmissionRequest): Promise<void> {
    const admission = await resolveTurnAdmission(this.turnAdmissionScope(), params);

    if (!admission) {
      return;
    }

    assertTurnAdmitted(admission);
    this.pendingTurnReservation = admission.reservation ?? undefined;
  }

  async releaseTurnReservation(outcome: "settled" | "released" = "released"): Promise<void> {
    const reservation = this.pendingTurnReservation;

    if (!reservation) {
      return;
    }

    this.pendingTurnReservation = undefined;
    await reservation.release(outcome);
  }

  async add(conversation_id: string, message: Message): Promise<Message> {
    const messages = await this.addBatch(conversation_id, [message]);

    return messages[0];
  }

  async addBatch(
    conversation_id: string,
    messages: Message[],
    options?: ConversationWriteOptions,
  ): Promise<Message[]> {
    if (!messages.length) {
      return [];
    }

    const normalisedMessages = this.prepareMessagesForStorage(messages);

    await this.assertWriteOwnership();
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
      await this.assertWriteOwnership();
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

  async persistCompaction(
    conversation_id: string,
    snapshotMessage: Message,
    compactionMessage: Message,
    messageIdsToArchive: string[],
  ): Promise<void> {
    const normalisedMessages = this.prepareMessagesForStorage([snapshotMessage, compactionMessage]);

    await this.assertWriteOwnership();
    await this.incrementUsageForAssistantResponse(normalisedMessages);

    if (!this.store) {
      return;
    }

    await this.ensureWritableConversation(
      conversation_id,
      "User ID is required to compact conversations",
      undefined,
      normalisedMessages,
    );

    await this.assertWriteOwnership();
    await this.database.repositories.messages.createCompactionAndArchiveMessages(
      conversation_id,
      normalisedMessages.map((message) => ({
        id: message.id,
        role: message.role,
        content: this.serializeMessageContent(message.content),
        data: message,
      })),
      messageIdsToArchive,
    );
  }

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

    await this.assertWriteOwnership();
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

      if (message.provenance !== undefined) {
        updates.provenance_json = message.provenance;
      }

      for (const [key, value] of Object.entries(message)) {
        if (!["id", "content", "parts", "provenance"].includes(key)) {
          updates[key] = value;
        }
      }

      if (Object.keys(updates).length > 0) {
        await this.assertWriteOwnership();
        await this.database.repositories.messages.updateMessage(
          conversation_id,
          message.id,
          updates,
        );
      }
    }
  }

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

    return messages.map(formatStoredMessage);
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
      formatMessage: formatStoredMessage,
      isHiddenMessage: (message) => !options.includeSnapshots && hasSnapshotPart(message),
    });
  }

  async getVisibleMessagesBefore(
    conversation_id: string,
    limit = 50,
    before?: string,
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
      after: before,
      direction: "before",
      includeArchived: options.includeArchived ?? true,
      loadMessages: (conversationId, pageLimit, cursor, pageOptions) =>
        this.database.repositories.messages.getConversationMessagesBefore(
          conversationId,
          pageLimit,
          cursor,
          pageOptions,
        ),
      formatMessage: formatStoredMessage,
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

    await this.assertWriteOwnership();
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

    await this.assertWriteOwnership();
    await this.database.repositories.messages.deleteMessages(conversation_id, messageIds);
    await this.refreshConversationMessageMetadata(conversation_id);
  }

  private async refreshConversationMessageMetadata(conversation_id: string): Promise<void> {
    const metadata =
      await this.database.repositories.messages.getConversationMessageMetadata(conversation_id);

    await this.assertWriteOwnership();
    await this.database.repositories.conversations.updateConversation(conversation_id, {
      last_message_id: metadata.last_message_id,
      last_message_at: metadata.last_message_id ? new Date().toISOString() : null,
      message_count: metadata.message_count,
    });
  }

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

    return {
      ...result,
      conversations: result.conversations.map((conversation) => ({
        ...conversation,
        model: conversation.model_id ?? null,
      })),
    };
  }

  async setArchivedForAll(options: SetConversationsArchivedOptions): Promise<number> {
    if (!this.user?.id) {
      throw new AssistantError(
        "Manager: User ID is required to archive conversations",
        ErrorType.AUTHENTICATION_ERROR,
      );
    }

    await this.assertWriteOwnership();

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

    return {
      ...conversation,
      model: conversation.model_id ?? null,
    };
  }

  async getConversationDetails(
    conversation_id: string,
    options: {
      includeArchived?: boolean;
      includeSnapshots?: boolean;
      messageLimit?: number;
    } = {},
  ): Promise<ConversationDetails> {
    const conversation = await this.getConversationMetadata(conversation_id);

    const storedConversationId =
      typeof conversation.id === "string" ? conversation.id : conversation_id;
    const messageLimit = options.messageLimit;

    if (messageLimit && messageLimit > 0) {
      const page = await this.getVisibleMessagesBefore(
        storedConversationId,
        messageLimit + 1,
        undefined,
        options,
      );
      const hasMoreMessages = page.length > messageLimit;
      const messages = hasMoreMessages ? page.slice(-messageLimit) : page;

      return {
        ...conversation,
        messages,
        has_more_messages: hasMoreMessages,
        oldest_message_id: messages[0]?.id ?? null,
      };
    }

    const dbMessages = await this.database.repositories.messages.getConversationMessages(
      storedConversationId,
      0,
      undefined,
      {
        includeArchived: options.includeArchived ?? true,
      },
    );

    const messages = dbMessages
      .map(formatStoredMessage)
      .filter((message) => options.includeSnapshots || !hasSnapshotPart(message));

    return {
      ...conversation,
      messages,
    };
  }

  async updateConversation(
    conversation_id: string,
    updates: {
      title?: string;
      archived?: boolean;
      permission_mode?: PermissionMode;
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

    if (updates.permission_mode !== undefined) {
      updateObj.permission_mode = updates.permission_mode;
    }

    await this.assertWriteOwnership();
    await this.database.repositories.conversations.updateConversation(conversation_id, updateObj);

    const updatedConversation =
      await this.database.repositories.conversations.getConversation(conversation_id);

    return updatedConversation || {};
  }

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

    const message = formatStoredMessage(result.message);

    return {
      message,
      conversation_id: result.conversation_id,
    };
  }

  private serializeMessageContent(messageContent: Message["content"]): string {
    if (typeof messageContent === "object") {
      return JSON.stringify(messageContent);
    }

    return messageContent || "";
  }

  private sharingScope(): ConversationSharingScope {
    return {
      repositories: this.database.repositories,
      user: this.user,
      canAccessConversation: (conversation) => this.canAccessConversation(conversation),
      assertWriteOwnership: () => this.assertWriteOwnership(),
    };
  }

  async shareConversation(conversation_id: string): Promise<{ share_id: string }> {
    return shareConversation(this.sharingScope(), conversation_id);
  }

  async unshareConversation(conversation_id: string): Promise<void> {
    await unshareConversation(this.sharingScope(), conversation_id);
  }

  async getPublicConversation(
    share_id: string,
    limit = 50,
    after?: string,
    options?: { includeArchived?: boolean },
  ): Promise<Message[]> {
    return getPublicConversation(this.database.repositories, share_id, limit, after, options);
  }
}
