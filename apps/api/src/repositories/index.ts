import type { IEnv } from "~/types";

import { ApiKeyRepository } from "./ApiKeyRepository";
import { AppDataRepository } from "./AppDataRepository";
import { BaseRepository } from "./BaseRepository";
import { ConversationRepository } from "./ConversationRepository";
import { EmbeddingRepository } from "./EmbeddingRepository";
import { MagicLinkNonceRepository } from "./MagicLinkNonceRepository";
import { MessageRepository } from "./MessageRepository";
import { SessionRepository } from "./SessionRepository";
import { UserRepository } from "./UserRepository";
import { UserSettingsRepository } from "./UserSettingsRepository";
import { WebAuthnRepository } from "./WebAuthnRepository";

export {
  ApiKeyRepository,
  AppDataRepository,
  BaseRepository,
  ConversationRepository,
  EmbeddingRepository,
  MagicLinkNonceRepository,
  MessageRepository,
  SessionRepository,
  UserRepository,
  UserSettingsRepository,
  WebAuthnRepository,
};

export class RepositoryManager {
  private env: IEnv;
  private static instance: RepositoryManager;

  private userRepo: UserRepository;
  private sessionRepo: SessionRepository;
  private userSettingsRepo: UserSettingsRepository;
  private conversationRepo: ConversationRepository;
  private messageRepo: MessageRepository;
  private embeddingRepo: EmbeddingRepository;
  private webAuthnRepo: WebAuthnRepository;
  private magicLinkNonceRepo: MagicLinkNonceRepository;
  private apiKeyRepo: ApiKeyRepository;
  private appDataRepo: AppDataRepository;

  private constructor(env: IEnv) {
    this.env = env;
    this.userRepo = new UserRepository(env);
    this.sessionRepo = new SessionRepository(env);
    this.userSettingsRepo = new UserSettingsRepository(env);
    this.conversationRepo = new ConversationRepository(env);
    this.messageRepo = new MessageRepository(env);
    this.embeddingRepo = new EmbeddingRepository(env);
    this.webAuthnRepo = new WebAuthnRepository(env);
    this.magicLinkNonceRepo = new MagicLinkNonceRepository(env);
    this.apiKeyRepo = new ApiKeyRepository(env);
    this.appDataRepo = new AppDataRepository(env);
  }

  public static getInstance(env: IEnv): RepositoryManager {
    if (!RepositoryManager.instance) {
      RepositoryManager.instance = new RepositoryManager(env);
    }
    return RepositoryManager.instance;
  }

  public get users(): UserRepository {
    return this.userRepo;
  }

  public get sessions(): SessionRepository {
    return this.sessionRepo;
  }

  public get userSettings(): UserSettingsRepository {
    return this.userSettingsRepo;
  }

  public get conversations(): ConversationRepository {
    return this.conversationRepo;
  }

  public get messages(): MessageRepository {
    return this.messageRepo;
  }

  public get embeddings(): EmbeddingRepository {
    return this.embeddingRepo;
  }

  public get webAuthn(): WebAuthnRepository {
    return this.webAuthnRepo;
  }

  public get magicLinkNonces(): MagicLinkNonceRepository {
    return this.magicLinkNonceRepo;
  }

  public get apiKeys(): ApiKeyRepository {
    return this.apiKeyRepo;
  }

  public get appData(): AppDataRepository {
    return this.appDataRepo;
  }
}
