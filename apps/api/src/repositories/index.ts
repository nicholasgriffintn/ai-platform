import type { IEnv } from "~/types";

import { AnonymousUserRepository } from "./AnonymousUserRepository";
import { ApiKeyRepository } from "./ApiKeyRepository";
import { AppDataRepository } from "./AppDataRepository";
import { BaseRepository } from "./BaseRepository";
import { ConversationRepository } from "./ConversationRepository";
import { EmbeddingRepository } from "./EmbeddingRepository";
import { MagicLinkNonceRepository } from "./MagicLinkNonceRepository";
import { MemoryRepository } from "./MemoryRepository";
import { MessageRepository } from "./MessageRepository";
import { PlanRepository } from "./PlanRepository";
import { SessionRepository } from "./SessionRepository";
import { UserRepository } from "./UserRepository";
import { UserSettingsRepository } from "./UserSettingsRepository";
import { WebAuthnRepository } from "./WebAuthnRepository";

export {
  AnonymousUserRepository,
  ApiKeyRepository,
  AppDataRepository,
  BaseRepository,
  ConversationRepository,
  EmbeddingRepository,
  MagicLinkNonceRepository,
  MemoryRepository,
  MessageRepository,
  SessionRepository,
  UserRepository,
  UserSettingsRepository,
  WebAuthnRepository,
  PlanRepository,
};

export class RepositoryManager {
  private static instance: RepositoryManager;
  private env: IEnv;

  private planRepo: PlanRepository;
  private userRepo: UserRepository;
  private anonymousUserRepo: AnonymousUserRepository;
  private sessionRepo: SessionRepository;
  private userSettingsRepo: UserSettingsRepository;
  private conversationRepo: ConversationRepository;
  private messageRepo: MessageRepository;
  private embeddingRepo: EmbeddingRepository;
  private webAuthnRepo: WebAuthnRepository;
  private magicLinkNonceRepo: MagicLinkNonceRepository;
  private memoryRepo: MemoryRepository;
  private apiKeyRepo: ApiKeyRepository;
  private appDataRepo: AppDataRepository;

  private constructor(env: IEnv) {
    this.env = env;
    this.planRepo = new PlanRepository(env);
    this.userRepo = new UserRepository(env);
    this.anonymousUserRepo = new AnonymousUserRepository(env);
    this.sessionRepo = new SessionRepository(env);
    this.userSettingsRepo = new UserSettingsRepository(env);
    this.conversationRepo = new ConversationRepository(env);
    this.messageRepo = new MessageRepository(env);
    this.embeddingRepo = new EmbeddingRepository(env);
    this.webAuthnRepo = new WebAuthnRepository(env);
    this.magicLinkNonceRepo = new MagicLinkNonceRepository(env);
    this.memoryRepo = new MemoryRepository(env);
    this.apiKeyRepo = new ApiKeyRepository(env);
    this.appDataRepo = new AppDataRepository(env);
  }

  public static getInstance(env: IEnv): RepositoryManager {
    if (!RepositoryManager.instance) {
      RepositoryManager.instance = new RepositoryManager(env);
    }
    return RepositoryManager.instance;
  }

  public get plans(): PlanRepository {
    return this.planRepo;
  }

  public get users(): UserRepository {
    return this.userRepo;
  }

  public get anonymousUsers(): AnonymousUserRepository {
    return this.anonymousUserRepo;
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

  public get memories(): MemoryRepository {
    return this.memoryRepo;
  }
}
