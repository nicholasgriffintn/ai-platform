import { RepositoryManager } from "../repositories";
import type { IEnv, User } from "../types";

export class Database {
  private env: IEnv;
  private static instance: Database;
  private repositories: RepositoryManager;

  private constructor(env: IEnv) {
    if (!env?.DB) {
      throw new Error("Database not configured");
    }
    this.env = env;
    this.repositories = RepositoryManager.getInstance(env);
  }

  public static getInstance(env: IEnv): Database {
    if (!Database.instance) {
      Database.instance = new Database(env);
    }
    return Database.instance;
  }

  // User methods
  public async getUserByGithubId(
    githubId: string,
  ): Promise<Record<string, unknown> | null> {
    return this.repositories.users.getUserByGithubId(githubId);
  }

  public async getUserBySessionId(
    sessionId: string,
  ): Promise<Record<string, unknown> | null> {
    return this.repositories.users.getUserBySessionId(sessionId);
  }

  public async getUserById(
    userId: number,
  ): Promise<Record<string, unknown> | null> {
    return this.repositories.users.getUserById(userId);
  }

  public async getUserByEmail(email: string): Promise<User | null> {
    return this.repositories.users.getUserByEmail(email);
  }

  public async updateUser(
    userId: number,
    userData: Record<string, unknown>,
  ): Promise<void> {
    return this.repositories.users.updateUser(userId, userData);
  }

  public async createOauthAccount(
    userId: number,
    providerId: string,
    providerUserId: string,
  ): Promise<void> {
    return this.repositories.users.createOauthAccount(
      userId,
      providerId,
      providerUserId,
    );
  }

  public async updateUserWithGithubData(
    userId: number,
    userData: Record<string, unknown>,
  ): Promise<void> {
    return this.repositories.users.updateUserWithGithubData(userId, userData);
  }

  public async createUser(
    userData: Record<string, unknown>,
  ): Promise<Record<string, unknown> | null> {
    const user = await this.repositories.users.createUser(userData);

    if (user && "id" in user) {
      await this.repositories.userSettings.createUserSettings(
        user.id as number,
      );

      await this.repositories.userSettings.createUserProviderSettings(
        user.id as number,
      );
    }

    return user;
  }

  // Session methods
  public async createSession(
    sessionId: string,
    userId: number,
    expiresAt: Date,
  ): Promise<void> {
    return this.repositories.sessions.createSession(
      sessionId,
      userId,
      expiresAt,
    );
  }

  public async deleteSession(sessionId: string): Promise<void> {
    return this.repositories.sessions.deleteSession(sessionId);
  }

  // User settings methods
  public async createUserSettings(userId: number): Promise<void> {
    return this.repositories.userSettings.createUserSettings(userId);
  }

  public async createUserProviderSettings(userId: number): Promise<void> {
    return this.repositories.userSettings.createUserProviderSettings(userId);
  }

  public async updateUserSettings(
    userId: number,
    settings: Record<string, unknown>,
  ): Promise<void> {
    return this.repositories.userSettings.updateUserSettings(userId, settings);
  }

  public async getUserSettings(
    userId: number,
  ): Promise<Record<string, unknown> | null> {
    return this.repositories.userSettings.getUserSettings(userId);
  }

  public async getUserEnabledModels(
    userId: number,
  ): Promise<Record<string, unknown>[]> {
    return this.repositories.userSettings.getUserEnabledModels(userId);
  }

  public async storeProviderApiKey(
    userId: number,
    providerId: string,
    apiKey: string,
    secretKey?: string,
  ): Promise<void> {
    return this.repositories.userSettings.storeProviderApiKey(
      userId,
      providerId,
      apiKey,
      secretKey,
    );
  }

  public async getProviderApiKey(
    userId: number,
    providerId: string,
  ): Promise<string | null> {
    return this.repositories.userSettings.getProviderApiKey(userId, providerId);
  }

  public async getUserProviderSettings(
    userId: number,
  ): Promise<Record<string, unknown>[]> {
    return this.repositories.userSettings.getUserProviderSettings(userId);
  }

  // Embedding methods
  public async getEmbedding(
    id: string,
    type?: string,
  ): Promise<Record<string, unknown> | null> {
    return this.repositories.embeddings.getEmbedding(id, type);
  }

  public async getEmbeddingIdByType(
    id: string,
    type: string,
  ): Promise<Record<string, unknown> | null> {
    return this.repositories.embeddings.getEmbeddingIdByType(id, type);
  }

  public async insertEmbedding(
    id: string,
    metadata: Record<string, unknown>,
    title: string,
    content: string,
    type: string,
  ): Promise<void> {
    return this.repositories.embeddings.insertEmbedding(
      id,
      metadata,
      title,
      content,
      type,
    );
  }

  // Conversation methods
  public async createConversation(
    conversationId: string,
    userId: number,
    title?: string,
    options: Record<string, unknown> = {},
  ): Promise<Record<string, unknown> | null> {
    return this.repositories.conversations.createConversation(
      conversationId,
      userId,
      title,
      options,
    );
  }

  public async getConversation(
    conversationId: string,
  ): Promise<Record<string, unknown> | null> {
    return this.repositories.conversations.getConversation(conversationId);
  }

  public async getConversationByShareId(
    shareId: string,
  ): Promise<Record<string, unknown> | null> {
    return this.repositories.conversations.getConversationByShareId(shareId);
  }

  public async getUserConversations(
    userId: number,
    limit = 25,
    page = 1,
    includeArchived = false,
  ): Promise<{
    conversations: Record<string, unknown>[];
    totalPages: number;
    pageNumber: number;
    pageSize: number;
  }> {
    return this.repositories.conversations.getUserConversations(
      userId,
      limit,
      page,
      includeArchived,
    );
  }

  public async updateConversation(
    conversationId: string,
    updates: Record<string, unknown>,
  ): Promise<D1Result<unknown> | null> {
    return this.repositories.conversations.updateConversation(
      conversationId,
      updates,
    );
  }

  public async deleteConversation(conversationId: string): Promise<void> {
    return this.repositories.conversations.deleteConversation(conversationId);
  }

  public async updateConversationAfterMessage(
    conversationId: string,
    messageId: string,
  ): Promise<void> {
    return this.repositories.conversations.updateConversationAfterMessage(
      conversationId,
      messageId,
    );
  }

  // Message methods
  public async createMessage(
    messageId: string,
    conversationId: string,
    role: string,
    content: string | Record<string, unknown>,
    messageData: Record<string, unknown> = {},
  ): Promise<Record<string, unknown> | null> {
    return this.repositories.messages.createMessage(
      messageId,
      conversationId,
      role,
      content,
      messageData,
    );
  }

  public async getMessage(
    messageId: string,
  ): Promise<Record<string, unknown> | null> {
    return this.repositories.messages.getMessage(messageId);
  }

  public async getConversationMessages(
    conversationId: string,
    limit = 50,
    after?: string,
  ): Promise<Record<string, unknown>[]> {
    return this.repositories.messages.getConversationMessages(
      conversationId,
      limit,
      after,
    );
  }

  /**
   * Get messages for a conversation - alias for getConversationMessages to be used by public conversations
   */
  public async getMessages(
    conversationId: string,
    limit = 50,
    after?: string,
  ): Promise<Record<string, unknown>[]> {
    return this.repositories.messages.getMessages(conversationId, limit, after);
  }

  public async updateMessage(
    messageId: string,
    updates: Record<string, unknown>,
  ): Promise<void> {
    return this.repositories.messages.updateMessage(messageId, updates);
  }

  public async deleteMessage(messageId: string): Promise<void> {
    return this.repositories.messages.deleteMessage(messageId);
  }

  public async getChildMessages(
    parentMessageId: string,
    limit = 50,
  ): Promise<Record<string, unknown>[]> {
    return this.repositories.messages.getChildMessages(parentMessageId, limit);
  }

  public async searchConversations(
    userId: number,
    query: string,
    limit = 25,
    offset = 0,
  ): Promise<Record<string, unknown>[]> {
    return this.repositories.conversations.searchConversations(
      userId,
      query,
      limit,
      offset,
    );
  }

  public async searchMessages(
    userId: number,
    query: string,
    limit = 25,
    offset = 0,
  ): Promise<Record<string, unknown>[]> {
    return this.repositories.messages.searchMessages(
      userId,
      query,
      limit,
      offset,
    );
  }

  public async getMessageById(messageId: string): Promise<{
    message: Record<string, unknown>;
    conversation_id: string;
    user_id: number;
  } | null> {
    return this.repositories.messages.getMessageById(messageId);
  }
}
