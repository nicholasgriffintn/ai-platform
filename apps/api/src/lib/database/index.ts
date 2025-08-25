import type { D1Database, D1Result } from "@cloudflare/workers-types";

import { RepositoryManager } from "~/repositories";
import type { ApiKeyMetadata } from "~/repositories/ApiKeyRepository";
import type { AnonymousUser, IEnv, IUserSettings, User } from "~/types";
import { logError } from "~/utils/errorLogger";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";

export * as schema from "./schema";

export interface Env {
  DB: D1Database;
}

const logger = getLogger({ prefix: "DATABASE" });

export class Database {
  private static instance: Database;
  private repositories: RepositoryManager;
  private env: IEnv;

  constructor(env: IEnv) {
    if (!env?.DB) {
      throw new AssistantError(
        "Database not configured",
        ErrorType.CONFIGURATION_ERROR,
      );
    }
    this.env = env;
    this.repositories = new RepositoryManager(env);
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
    try {
      return this.repositories.users.getUserByGithubId(githubId);
    } catch (error) {
      logger.error(`Error getting user by Github ID: ${error}`);
      return null;
    }
  }

  public async getUserBySessionId(
    sessionId: string,
  ): Promise<Record<string, unknown> | null> {
    try {
      return this.repositories.users.getUserBySessionId(sessionId);
    } catch (error) {
      logger.error(`Error getting user by session ID: ${error}`);
      return null;
    }
  }

  public async getUserById(userId: number): Promise<User | null> {
    try {
      const result = await this.repositories.users.getUserById(userId);
      return result as unknown as User | null;
    } catch (error) {
      logError("Failed to get user by ID", error, {
        userId,
        operation: "getUserById",
      });

      throw new AssistantError(
        "Unable to retrieve user data",
        ErrorType.INTERNAL_ERROR,
        500,
        { userId },
      );
    }
  }

  public async getUserByEmail(email: string): Promise<User | null> {
    try {
      const result = await this.repositories.users.getUserByEmail(email);
      return result as unknown as User | null;
    } catch (error) {
      logError("Failed to get user by email", error, {
        email,
        operation: "getUserByEmail",
      });

      throw new AssistantError(
        "Unable to retrieve user data",
        ErrorType.INTERNAL_ERROR,
        500,
        { email },
      );
    }
  }

  public async updateUser(
    userId: number,
    userData: Record<string, unknown>,
  ): Promise<void> {
    try {
      return this.repositories.users.updateUser(userId, userData);
    } catch (error) {
      logger.error(`Error updating user: ${error}`);
    }
  }

  public async createOauthAccount(
    userId: number,
    providerId: string,
    providerUserId: string,
  ): Promise<void> {
    try {
      return this.repositories.users.createOauthAccount(
        userId,
        providerId,
        providerUserId,
      );
    } catch (error) {
      logger.error(`Error creating oauth account: ${error}`);
    }
  }

  public async updateUserWithGithubData(
    userId: number,
    userData: Record<string, unknown>,
  ): Promise<void> {
    try {
      return this.repositories.users.updateUserWithGithubData(userId, userData);
    } catch (error) {
      logger.error(`Error updating user with Github data: ${error}`);
    }
  }

  public async getUserByStripeCustomerId(
    customerId: string,
  ): Promise<User | null> {
    try {
      const result =
        await this.repositories.users.getUserByStripeCustomerId(customerId);
      return result as unknown as User | null;
    } catch (error) {
      logger.error(`Error getting user by Stripe customer ID: ${error}`);
      return null;
    }
  }

  public async createUser(
    userData: Record<string, unknown>,
  ): Promise<Record<string, unknown> | null> {
    try {
      const user = await this.repositories.users.createUser(userData);

      if (user && "id" in user) {
        try {
          await this.repositories.userSettings.createUserSettings(
            user.id as number,
          );
        } catch (settingsError) {
          logError(
            "Failed to create user settings during user creation",
            settingsError,
            {
              operation: "createUserSettings",
            },
          );
        }

        try {
          await this.repositories.userSettings.createUserProviderSettings(
            user.id as number,
          );
        } catch (providerSettingsError) {
          logError(
            "Failed to create user provider settings during user creation",
            providerSettingsError,
            {
              operation: "createUserProviderSettings",
            },
          );
        }
      }

      return user;
    } catch (error) {
      logError("Failed to create user", error, {
        operation: "createUser",
        userData: { ...userData, password: "REDACTED" },
      });

      throw new AssistantError(
        "Unable to create user account",
        ErrorType.DATABASE_ERROR,
        500,
      );
    }
  }

  // Session methods
  public async createSession(
    sessionId: string,
    userId: number,
    expiresAt: Date,
  ): Promise<void> {
    try {
      return this.repositories.sessions.createSession(
        sessionId,
        userId,
        expiresAt,
      );
    } catch (error) {
      logError("Failed to create session", error, {
        userId,
        sessionId,
        operation: "createSession",
      });

      throw new AssistantError(
        "Unable to create user session",
        ErrorType.DATABASE_ERROR,
        500,
        { userId },
      );
    }
  }

  public async deleteSession(sessionId: string): Promise<void> {
    try {
      return this.repositories.sessions.deleteSession(sessionId);
    } catch (error) {
      logger.error(`Error deleting session: ${error}`);
    }
  }

  // User settings methods
  public async createUserSettings(userId: number): Promise<void> {
    try {
      return this.repositories.userSettings.createUserSettings(userId);
    } catch (error) {
      logger.error(`Error creating user settings: ${error}`);
    }
  }

  public async createUserProviderSettings(userId: number): Promise<void> {
    try {
      return this.repositories.userSettings.createUserProviderSettings(userId);
    } catch (error) {
      logger.error(`Error creating user provider settings: ${error}`);
    }
  }

  public async updateUserSettings(
    userId: number,
    settings: Record<string, unknown>,
  ): Promise<void> {
    try {
      return this.repositories.userSettings.updateUserSettings(
        userId,
        settings,
      );
    } catch (error) {
      logger.error(`Error updating user settings: ${error}`);
    }
  }

  public async getUserSettings(userId: number): Promise<IUserSettings | null> {
    try {
      if (!userId) {
        return null;
      }

      return this.repositories.userSettings.getUserSettings(userId);
    } catch (error) {
      logError("Failed to get user settings", error, {
        operation: "getUserSettings",
      });

      return null;
    }
  }

  public async getUserEnabledModels(
    userId: number,
  ): Promise<Record<string, unknown>[]> {
    try {
      return this.repositories.userSettings.getUserEnabledModels(userId);
    } catch (error) {
      logger.error(`Error getting user enabled models: ${error}`);
      return [];
    }
  }

  public async storeProviderApiKey(
    userId: number,
    providerId: string,
    apiKey: string,
    secretKey?: string,
  ): Promise<void> {
    try {
      return this.repositories.userSettings.storeProviderApiKey(
        userId,
        providerId,
        apiKey,
        secretKey,
      );
    } catch (error) {
      logger.error(`Error storing provider API key: ${error}`);
    }
  }

  public async getProviderApiKey(
    userId: number,
    providerId: string,
  ): Promise<string | null> {
    try {
      return this.repositories.userSettings.getProviderApiKey(
        userId,
        providerId,
      );
    } catch (error) {
      logger.error(`Error getting provider API key: ${error}`);
      return null;
    }
  }
  public async getUserProviderSettings(
    userId: number,
  ): Promise<Record<string, unknown>[]> {
    try {
      return this.repositories.userSettings.getUserProviderSettings(userId);
    } catch (error) {
      logger.error(`Error getting user provider settings: ${error}`);
      return [];
    }
  }

  // Embedding methods
  public async getEmbedding(
    id: string,
    type?: string,
  ): Promise<Record<string, unknown> | null> {
    try {
      return this.repositories.embeddings.getEmbedding(id, type);
    } catch (error) {
      logger.error(`Error getting embedding: ${error}`);
      return null;
    }
  }

  public async getEmbeddingIdByType(
    id: string,
    type: string,
  ): Promise<Record<string, unknown> | null> {
    try {
      return this.repositories.embeddings.getEmbeddingIdByType(id, type);
    } catch (error) {
      logger.error(`Error getting embedding ID by type: ${error}`);
      return null;
    }
  }

  public async insertEmbedding(
    id: string,
    metadata: Record<string, unknown>,
    title: string,
    content: string,
    type: string,
  ): Promise<void> {
    try {
      return this.repositories.embeddings.insertEmbedding(
        id,
        metadata,
        title,
        content,
        type,
      );
    } catch (error) {
      logger.error(`Error inserting embedding: ${error}`);
    }
  }

  // Conversation methods
  public async createConversation(
    conversationId: string,
    userId: number,
    title?: string,
    options: Record<string, unknown> = {},
  ): Promise<Record<string, unknown> | null> {
    try {
      return this.repositories.conversations.createConversation(
        conversationId,
        userId,
        title,
        options,
      );
    } catch (error) {
      logger.error(`Error creating conversation: ${error}`);
      return null;
    }
  }

  public async getConversation(
    conversationId: string,
  ): Promise<Record<string, unknown> | null> {
    try {
      return this.repositories.conversations.getConversation(conversationId);
    } catch (error) {
      logger.error(`Error getting conversation: ${error}`);
      return null;
    }
  }

  public async getConversationByShareId(
    shareId: string,
  ): Promise<Record<string, unknown> | null> {
    try {
      return this.repositories.conversations.getConversationByShareId(shareId);
    } catch (error) {
      logger.error(`Error getting conversation by share ID: ${error}`);
      return null;
    }
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
    try {
      return this.repositories.conversations.getUserConversations(
        userId,
        limit,
        page,
        includeArchived,
      );
    } catch (error) {
      logger.error(`Error getting user conversations: ${error}`);
      return {
        conversations: [],
        totalPages: 0,
        pageNumber: 0,
        pageSize: 0,
      };
    }
  }

  public async updateConversation(
    conversationId: string,
    updates: Record<string, unknown>,
  ): Promise<D1Result<unknown> | null> {
    try {
      return this.repositories.conversations.updateConversation(
        conversationId,
        updates,
      );
    } catch (error) {
      logger.error(`Error updating conversation: ${error}`);
      return null;
    }
  }

  public async deleteConversation(conversationId: string): Promise<void> {
    try {
      return this.repositories.conversations.deleteConversation(conversationId);
    } catch (error) {
      logger.error(`Error deleting conversation: ${error}`);
    }
  }

  public async updateConversationAfterMessage(
    conversationId: string,
    messageId: string,
  ): Promise<void> {
    try {
      return this.repositories.conversations.updateConversationAfterMessage(
        conversationId,
        messageId,
      );
    } catch (error) {
      logger.error(`Error updating conversation after message: ${error}`);
    }
  }

  // Message methods
  public async createMessage(
    messageId: string,
    conversationId: string,
    role: string,
    content: string | Record<string, unknown>,
    messageData: Record<string, unknown> = {},
  ): Promise<Record<string, unknown> | null> {
    try {
      return this.repositories.messages.createMessage(
        messageId,
        conversationId,
        role,
        content,
        messageData,
      );
    } catch (error) {
      logger.error(`Error creating message: ${error}`);
      return null;
    }
  }

  public async getMessage(
    messageId: string,
  ): Promise<Record<string, unknown> | null> {
    try {
      return this.repositories.messages.getMessage(messageId);
    } catch (error) {
      logger.error(`Error getting message: ${error}`);
      return null;
    }
  }

  public async getConversationMessages(
    conversationId: string,
    limit = 50,
    after?: string,
  ): Promise<Record<string, unknown>[]> {
    try {
      return this.repositories.messages.getConversationMessages(
        conversationId,
        limit,
        after,
      );
    } catch (error) {
      logger.error(`Error getting conversation messages: ${error}`);
      return [];
    }
  }

  public async getMessages(
    conversationId: string,
    limit = 50,
    after?: string,
  ): Promise<Record<string, unknown>[]> {
    try {
      return this.repositories.messages.getMessages(
        conversationId,
        limit,
        after,
      );
    } catch (error) {
      logger.error(`Error getting messages: ${error}`);
      return [];
    }
  }

  public async updateMessage(
    messageId: string,
    updates: Record<string, unknown>,
  ): Promise<void> {
    try {
      return this.repositories.messages.updateMessage(messageId, updates);
    } catch (error) {
      logger.error(`Error updating message: ${error}`);
    }
  }

  public async deleteMessage(messageId: string): Promise<void> {
    try {
      return this.repositories.messages.deleteMessage(messageId);
    } catch (error) {
      logger.error(`Error deleting message: ${error}`);
    }
  }

  public async deleteAllChatCompletions(userId: number): Promise<void> {
    try {
      const allConversations = await this.getUserConversations(userId, 1000);
      if (allConversations.conversations.length === 0) {
        return;
      }
      for (const conversation of allConversations.conversations) {
        if (!conversation.id || typeof conversation.id !== "string") {
          continue;
        }
        await this.repositories.messages.deleteAllMessages(conversation.id);
        await this.deleteConversation(conversation.id);
      }

      return;
    } catch (error) {
      logger.error(`Error deleting all chat completions: ${error}`);
    }
  }

  public async getChildMessages(
    parentMessageId: string,
    limit = 50,
  ): Promise<Record<string, unknown>[]> {
    try {
      return this.repositories.messages.getChildMessages(
        parentMessageId,
        limit,
      );
    } catch (error) {
      logger.error(`Error getting child messages: ${error}`);
      return [];
    }
  }

  public async searchConversations(
    userId: number,
    query: string,
    limit = 25,
    offset = 0,
  ): Promise<Record<string, unknown>[]> {
    try {
      return this.repositories.conversations.searchConversations(
        userId,
        query,
        limit,
        offset,
      );
    } catch (error) {
      logger.error(`Error searching conversations: ${error}`);
      return [];
    }
  }

  public async searchMessages(
    userId: number,
    query: string,
    limit = 25,
    offset = 0,
  ): Promise<Record<string, unknown>[]> {
    try {
      return this.repositories.messages.searchMessages(
        userId,
        query,
        limit,
        offset,
      );
    } catch (error) {
      logger.error(`Error searching messages: ${error}`);
      return [];
    }
  }

  public async getMessageById(messageId: string): Promise<{
    message: Record<string, unknown>;
    conversation_id: string;
    user_id: number;
  } | null> {
    try {
      return this.repositories.messages.getMessageById(messageId);
    } catch (error) {
      logger.error(`Error getting message by ID: ${error}`);
      return null;
    }
  }

  // WebAuthn methods

  public async createWebAuthnChallenge(
    challenge: string,
    userId?: number,
    expiresInMinutes = 5,
  ): Promise<void> {
    try {
      return this.repositories.webAuthn.createChallenge(
        challenge,
        userId,
        expiresInMinutes,
      );
    } catch (error) {
      logger.error(`Error creating web authn challenge: ${error}`);
    }
  }

  public async getWebAuthnChallenge(
    challenge: string,
    userId?: number,
  ): Promise<{ challenge: string } | null> {
    try {
      return this.repositories.webAuthn.getChallenge(challenge, userId);
    } catch (error) {
      logger.error(`Error getting web authn challenge: ${error}`);
      return null;
    }
  }

  public async getWebAuthnChallengeByUserId(
    userId: number,
  ): Promise<{ challenge: string } | null> {
    try {
      return this.repositories.webAuthn.getChallengeByUserId(userId);
    } catch (error) {
      logger.error(`Error getting web authn challenge by user ID: ${error}`);
      return null;
    }
  }

  public async deleteWebAuthnChallenge(
    challenge: string,
    userId?: number,
  ): Promise<void> {
    try {
      return this.repositories.webAuthn.deleteChallenge(challenge, userId);
    } catch (error) {
      logger.error(`Error deleting web authn challenge: ${error}`);
    }
  }

  public async createPasskey(
    userId: number,
    credentialId: string,
    publicKey: Uint8Array,
    counter: number,
    deviceType: string,
    backedUp: boolean,
    transports?: any[],
  ): Promise<void> {
    try {
      return this.repositories.webAuthn.createPasskey(
        userId,
        credentialId,
        publicKey,
        counter,
        deviceType,
        backedUp,
        transports,
      );
    } catch (error) {
      logger.error(`Error creating passkey: ${error}`);
    }
  }

  public async getPasskeysByUserId(
    userId: number,
  ): Promise<Record<string, unknown>[]> {
    try {
      return this.repositories.webAuthn.getPasskeysByUserId(userId);
    } catch (error) {
      logger.error(`Error getting passkeys by user ID: ${error}`);
      return [];
    }
  }

  public async getPasskeyByCredentialId(
    credentialId: string,
  ): Promise<Record<string, unknown> | null> {
    try {
      return this.repositories.webAuthn.getPasskeyByCredentialId(credentialId);
    } catch (error) {
      logger.error(`Error getting passkey by credential ID: ${error}`);
      return null;
    }
  }

  public async updatePasskeyCounter(
    credentialId: string,
    counter: number,
  ): Promise<void> {
    try {
      return this.repositories.webAuthn.updatePasskeyCounter(
        credentialId,
        counter,
      );
    } catch (error) {
      logger.error(`Error updating passkey counter: ${error}`);
    }
  }

  public async deletePasskey(
    passkeyId: number,
    userId: number,
  ): Promise<boolean> {
    try {
      return this.repositories.webAuthn.deletePasskey(passkeyId, userId);
    } catch (error) {
      logger.error(`Error deleting passkey: ${error}`);
      return false;
    }
  }

  // MagicLinkNonce methods

  public async createMagicLinkNonce(
    nonce: string,
    userId: number,
    expiresAt: Date,
  ): Promise<void> {
    try {
      return this.repositories.magicLinkNonces.createNonce(
        nonce,
        userId,
        expiresAt,
      );
    } catch (error) {
      logger.error(`Error creating magic link nonce: ${error}`);
    }
  }

  public async consumeMagicLinkNonce(
    nonce: string,
    userId: number,
  ): Promise<boolean> {
    try {
      const foundNonce = await this.repositories.magicLinkNonces.findNonce(
        nonce,
        userId,
      );

      if (!foundNonce) {
        return false;
      }

      await this.repositories.magicLinkNonces.deleteNonce(nonce);
      return true;
    } catch (error) {
      logger.error(`Error consuming nonce ${nonce}:`, { error });
      return false;
    }
  }

  // API key methods

  public async getUserApiKeys(userId: number): Promise<ApiKeyMetadata[]> {
    try {
      if (!userId) {
        throw new AssistantError("User ID is required", ErrorType.PARAMS_ERROR);
      }
      return this.repositories.apiKeys.getUserApiKeys(userId);
    } catch (error) {
      logger.error(`Error getting user API keys: ${error}`);
      return [];
    }
  }

  public async createApiKey(
    userId: number,
    name?: string,
  ): Promise<{ plaintextKey: string; metadata: ApiKeyMetadata }> {
    try {
      if (!userId) {
        throw new AssistantError("User ID is required", ErrorType.PARAMS_ERROR);
      }
      return this.repositories.apiKeys.createApiKey(userId, name);
    } catch (error) {
      logger.error(`Error creating API key: ${error}`);
      throw error;
    }
  }

  public async deleteApiKey(userId: number, apiKeyId: string): Promise<void> {
    try {
      if (!userId || !apiKeyId) {
        throw new AssistantError(
          "User ID and API Key ID are required",
          ErrorType.PARAMS_ERROR,
        );
      }
      return this.repositories.apiKeys.deleteApiKey(userId, apiKeyId);
    } catch (error) {
      logger.error(`Error deleting API key: ${error}`);
    }
  }

  public async findUserIdByApiKey(apiKey: string): Promise<number | null> {
    try {
      return this.repositories.apiKeys.findUserIdByApiKey(apiKey);
    } catch (error) {
      logger.error(`Error finding user ID by API key: ${error}`);
      return null;
    }
  }

  // Anonymous user methods

  public async getAnonymousUserById(id: string): Promise<AnonymousUser | null> {
    try {
      return this.repositories.anonymousUsers.getAnonymousUserById(id);
    } catch (error) {
      logger.error(`Error getting anonymous user by ID: ${error}`);
      return null;
    }
  }

  public async getAnonymousUserByIp(
    ipAddress: string,
  ): Promise<AnonymousUser | null> {
    try {
      return this.repositories.anonymousUsers.getAnonymousUserByIp(ipAddress);
    } catch (error) {
      logger.error(`Error getting anonymous user by IP: ${error}`);
      return null;
    }
  }

  public async createOrUpdateAnonymousUser(
    ipAddress: string,
    userAgent?: string,
    id?: string,
  ): Promise<AnonymousUser | null> {
    try {
      return this.repositories.anonymousUsers.createOrUpdateAnonymousUser(
        ipAddress,
        userAgent,
        id,
      );
    } catch (error) {
      logger.error(`Error creating anonymous user: ${error}`);
      return null;
    }
  }

  public async updateAnonymousUser(
    id: string,
    userData: Partial<AnonymousUser>,
  ): Promise<AnonymousUser | null> {
    try {
      return this.repositories.anonymousUsers.updateAnonymousUser(id, userData);
    } catch (error) {
      logger.error(`Error updating anonymous user: ${error}`);
      return null;
    }
  }

  public async getOrCreateAnonymousUser(
    ipAddress: string,
    userAgent?: string,
  ): Promise<AnonymousUser | null> {
    try {
      return this.repositories.anonymousUsers.getOrCreateAnonymousUser(
        ipAddress,
        userAgent,
      );
    } catch (error) {
      logger.error(`Error getting or creating anonymous user: ${error}`);
      return null;
    }
  }

  public async checkAndResetAnonymousUserDailyLimit(
    id: string,
  ): Promise<{ count: number; isNewDay: boolean }> {
    try {
      return this.repositories.anonymousUsers.checkAndResetDailyLimit(id);
    } catch (error) {
      logger.error(
        `Error checking and resetting anonymous user daily limit: ${error}`,
      );
      return { count: 0, isNewDay: false };
    }
  }

  public async incrementAnonymousUserDailyCount(id: string): Promise<void> {
    try {
      return this.repositories.anonymousUsers.incrementDailyCount(id);
    } catch (error) {
      logger.error(`Error incrementing anonymous user daily count: ${error}`);
    }
  }

  // Plan methods

  public async getAllPlans(): Promise<Record<string, unknown>[]> {
    try {
      return this.repositories.plans.getAllPlans();
    } catch (error) {
      logger.error(`Error getting all plans: ${error}`);
      return [];
    }
  }

  public async getPlanById(
    planId: string,
  ): Promise<Record<string, unknown> | null> {
    try {
      return this.repositories.plans.getPlanById(planId);
    } catch (error) {
      logger.error(`Error getting plan by ID: ${error}`);
      return null;
    }
  }
}
