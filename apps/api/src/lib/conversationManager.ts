import { generateId } from "~/utils/id";
import type { Message, MessageContent, Platform } from "../types";
import { AssistantError, ErrorType } from "../utils/errors";
import type { Database } from "./database";

export class ConversationManager {
  private static instance: ConversationManager;
  private database: Database;
  private model?: string;
  private platform?: Platform;
  private store?: boolean = true;
  private userId?: number;

  private constructor(
    database: Database,
    userId?: number,
    model?: string,
    platform?: Platform,
    store?: boolean,
  ) {
    this.database = database;
    this.userId = userId;
    this.model = model;
    this.platform = platform || "api";
    this.store = store ?? true;
  }

  public static getInstance({
    database,
    userId,
    model,
    platform,
    store,
  }: {
    database: Database;
    userId?: number;
    model?: string;
    platform?: Platform;
    store?: boolean;
  }): ConversationManager {
    if (!ConversationManager.instance) {
      ConversationManager.instance = new ConversationManager(
        database,
        userId,
        model,
        platform,
        store ?? true,
      );
    } else {
      ConversationManager.instance.database = database;
      ConversationManager.instance.userId = userId;
      ConversationManager.instance.model = model;
      ConversationManager.instance.platform = platform;
      ConversationManager.instance.store = store ?? true;
    }

    return ConversationManager.instance;
  }

  /**
   * Add a message to a conversation
   * If the conversation doesn't exist, it will be created
   */
  async add(conversation_id: string, message: Message): Promise<Message> {
    if (!this.store) {
      return {
        ...message,
        id: message.id || generateId(),
        timestamp: message.timestamp || Date.now(),
        model: message.model || this.model,
        platform: message.platform || this.platform,
      };
    }

    if (!this.userId) {
      throw new AssistantError(
        "User ID is required to store conversations",
        ErrorType.AUTHENTICATION_ERROR,
      );
    }

    let conversation = await this.database.getConversation(conversation_id);

    if (!conversation) {
      conversation = await this.database.createConversation(
        conversation_id,
        this.userId,
        "New Conversation",
      );
    } else if (conversation.user_id !== this.userId) {
      throw new AssistantError(
        "You don't have permission to update this conversation",
        ErrorType.FORBIDDEN,
      );
    }

    const newMessage = {
      ...message,
      id: message.id || generateId(),
      timestamp: message.timestamp || Date.now(),
      model: message.model || this.model,
      platform: message.platform || this.platform,
    };

    let content: string;
    if (typeof newMessage.content === "object") {
      content = JSON.stringify(newMessage.content);
    } else {
      content = newMessage.content || "";
    }

    await this.database.createMessage(
      newMessage.id as string,
      conversation_id,
      newMessage.role,
      content,
      newMessage,
    );

    await this.database.updateConversationAfterMessage(
      conversation_id,
      newMessage.id as string,
    );

    return newMessage;
  }

  /**
   * Add multiple messages to a conversation in batch
   */
  async addBatch(
    conversation_id: string,
    messages: Message[],
  ): Promise<Message[]> {
    if (!messages.length) return [];

    if (!this.store) {
      return messages.map((message) => ({
        ...message,
        id: message.id || generateId(),
        timestamp: message.timestamp || Date.now(),
        model: message.model || this.model,
        platform: message.platform || this.platform,
      }));
    }

    if (!this.userId) {
      throw new AssistantError(
        "User ID is required to store conversations",
        ErrorType.AUTHENTICATION_ERROR,
      );
    }

    let conversation = await this.database.getConversation(conversation_id);

    if (!conversation) {
      conversation = await this.database.createConversation(
        conversation_id,
        this.userId,
        "New Conversation",
      );
    } else if (conversation.user_id !== this.userId) {
      throw new AssistantError(
        "You don't have permission to update this conversation",
        ErrorType.FORBIDDEN,
      );
    }

    const newMessages = messages.map((message) => ({
      ...message,
      id: message.id || generateId(),
      timestamp: message.timestamp || Date.now(),
      model: message.model || this.model,
      platform: message.platform || this.platform,
    }));

    const createPromises = newMessages.map((message) => {
      let content: string;
      if (typeof message.content === "object") {
        content = JSON.stringify(message.content);
      } else {
        content = message.content || "";
      }

      return this.database.createMessage(
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
      await this.database.updateConversationAfterMessage(
        conversation_id,
        lastMessage.id as string,
      );
    }

    return newMessages;
  }

  /**
   * Update existing messages in a conversation
   */
  async update(conversation_id: string, messages: Message[]): Promise<void> {
    if (!this.store) {
      return;
    }

    if (!this.userId) {
      throw new AssistantError(
        "User ID is required to update messages",
        ErrorType.AUTHENTICATION_ERROR,
      );
    }

    const conversation = await this.database.getConversation(conversation_id);
    if (!conversation) {
      throw new AssistantError("Conversation not found", ErrorType.NOT_FOUND);
    }

    if (conversation.user_id !== this.userId) {
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
        await this.database.updateMessage(message.id, updates);
      }
    }
  }

  /**
   * Get all messages in a conversation
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

    if (!this.userId) {
      throw new AssistantError(
        "User ID is required to retrieve messages",
        ErrorType.AUTHENTICATION_ERROR,
      );
    }

    const conversation = await this.database.getConversation(conversation_id);
    if (!conversation) {
      throw new AssistantError("Conversation not found", ErrorType.NOT_FOUND);
    }

    if (conversation.user_id !== this.userId) {
      throw new AssistantError(
        "You don't have permission to access this conversation",
        ErrorType.FORBIDDEN,
      );
    }

    const messages = await this.database.getConversationMessages(
      conversation_id,
      limit,
      after,
    );

    return messages.map((dbMessage) => this.formatMessage(dbMessage));
  }

  /**
   * Get a list of conversation IDs
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
    if (!this.userId) {
      throw new AssistantError(
        "User ID is required to list conversations",
        ErrorType.AUTHENTICATION_ERROR,
      );
    }

    const result = await this.database.getUserConversations(
      this.userId,
      limit,
      page,
      includeArchived,
    );

    const conversations = result.conversations.map((conversation) => {
      const messagesString = conversation.messages as string;

      return {
        ...conversation,
        messages: messagesString ? messagesString.split(",") : [],
      };
    });

    return {
      ...result,
      conversations,
    };
  }

  /**
   * Get conversation details
   */
  async getConversationDetails(
    conversation_id: string,
  ): Promise<Record<string, unknown>> {
    if (!this.userId) {
      throw new AssistantError(
        "User ID is required to get conversation details",
        ErrorType.AUTHENTICATION_ERROR,
      );
    }

    const conversation = await this.database.getConversation(conversation_id);
    if (!conversation) {
      throw new AssistantError("Conversation not found", ErrorType.NOT_FOUND);
    }

    if (conversation.user_id !== this.userId) {
      throw new AssistantError(
        "You don't have permission to access this conversation",
        ErrorType.FORBIDDEN,
      );
    }

    const dbMessages = await this.database.getConversationMessages(
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

    if (!this.userId) {
      throw new AssistantError(
        "User ID is required to update a conversation",
        ErrorType.AUTHENTICATION_ERROR,
      );
    }

    const conversation = await this.database.getConversation(conversation_id);
    if (!conversation) {
      throw new AssistantError("Conversation not found", ErrorType.NOT_FOUND);
    }

    if (conversation.user_id !== this.userId) {
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

    await this.database.updateConversation(conversation_id, updateObj);

    const updatedConversation =
      await this.database.getConversation(conversation_id);
    return updatedConversation || {};
  }

  /**
   * Get a message by its ID
   */
  async getMessageById(
    message_id: string,
  ): Promise<{ message: Message; conversation_id: string }> {
    if (!this.userId) {
      throw new AssistantError(
        "User ID is required to retrieve a message",
        ErrorType.AUTHENTICATION_ERROR,
      );
    }

    const result = await this.database.getMessageById(message_id);

    if (!result) {
      throw new AssistantError("Message not found", ErrorType.NOT_FOUND);
    }

    if (result.user_id !== this.userId) {
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
   * Get messages for a webhook (no user authentication required)
   * This method is specifically for external service callbacks
   */
  async getFromWebhook(conversation_id: string): Promise<Message[]> {
    if (!this.store) {
      return [];
    }

    const conversation = await this.database.getConversation(conversation_id);
    if (!conversation) {
      throw new AssistantError("Conversation not found", ErrorType.NOT_FOUND);
    }

    const messages =
      await this.database.getConversationMessages(conversation_id);

    return messages.map((dbMessage) => this.formatMessage(dbMessage));
  }

  /**
   * Update messages for a webhook (no user authentication required)
   * This method is specifically for external service callbacks
   */
  async updateFromWebhook(
    conversation_id: string,
    messages: Message[],
  ): Promise<void> {
    if (!this.store) {
      return;
    }

    const conversation = await this.database.getConversation(conversation_id);
    if (!conversation) {
      throw new AssistantError("Conversation not found", ErrorType.NOT_FOUND);
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
        await this.database.updateMessage(message.id, updates);
      }
    }
  }

  /**
   * Format a database message record into a Message object
   */
  private formatMessage(dbMessage: Record<string, unknown>): Message {
    let content: string | MessageContent[] = dbMessage.content as string;

    try {
      if (
        typeof content === "string" &&
        (content.startsWith("[") || content.startsWith("{"))
      ) {
        const parsed = JSON.parse(content);
        content = parsed;
      }
    } catch (e) {
      console.error(e);
    }

    return {
      ...dbMessage,
      id: dbMessage.id,
      role: dbMessage.role as string,
      content,
      model: dbMessage.model as string,
      name: dbMessage.name as string,
      tool_calls: dbMessage.tool_calls
        ? JSON.parse(dbMessage.tool_calls as string)
        : undefined,
      citations: dbMessage.citations
        ? JSON.parse(dbMessage.citations as string)
        : undefined,
      status: dbMessage.status as string,
      timestamp: dbMessage.timestamp as number,
      platform: dbMessage.platform as string,
      mode: dbMessage.mode as string,
      data: dbMessage.data ? JSON.parse(dbMessage.data as string) : undefined,
      usage: dbMessage.usage
        ? JSON.parse(dbMessage.usage as string)
        : undefined,
      log_id: dbMessage.log_id as string,
    } as Message;
  }

  /**
   * Generate a unique ID for sharing a conversation
   */
  generateShareId(): string {
    return crypto.randomUUID();
  }

  /**
   * Make a conversation public by setting is_public to true and generating a share_id
   */
  async shareConversation(
    conversation_id: string,
  ): Promise<{ share_id: string }> {
    if (!this.userId) {
      throw new AssistantError(
        "User ID is required to share conversations",
        ErrorType.AUTHENTICATION_ERROR,
      );
    }

    const conversation = await this.database.getConversation(conversation_id);

    if (!conversation) {
      throw new AssistantError("Conversation not found", ErrorType.NOT_FOUND);
    }

    if (conversation.user_id !== this.userId) {
      throw new AssistantError(
        "You don't have permission to share this conversation",
        ErrorType.FORBIDDEN,
      );
    }

    const share_id =
      (conversation.share_id as string) || this.generateShareId();

    const updatedConversation = await this.database.updateConversation(
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
   */
  async unshareConversation(conversation_id: string): Promise<void> {
    if (!this.userId) {
      throw new AssistantError(
        "User ID is required to unshare conversations",
        ErrorType.AUTHENTICATION_ERROR,
      );
    }

    const conversation = await this.database.getConversation(conversation_id);

    if (!conversation) {
      throw new AssistantError("Conversation not found", ErrorType.NOT_FOUND);
    }

    if (conversation.user_id !== this.userId) {
      throw new AssistantError(
        "You don't have permission to unshare this conversation",
        ErrorType.FORBIDDEN,
      );
    }

    const updatedConversation = await this.database.updateConversation(
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
   */
  async getPublicConversation(
    share_id: string,
    limit = 50,
    after?: string,
  ): Promise<Message[]> {
    const conversation = await this.database.getConversationByShareId(share_id);

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

    const messages = await this.database.getMessages(
      conversation.id as string,
      limit,
      after,
    );
    return messages.map((message) => this.formatMessage(message));
  }
}
