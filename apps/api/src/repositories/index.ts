import type { IEnv } from "../types";

import { BaseRepository } from "./BaseRepository";
import { ConversationRepository } from "./ConversationRepository";
import { EmbeddingRepository } from "./EmbeddingRepository";
import { MessageRepository } from "./MessageRepository";
import { SessionRepository } from "./SessionRepository";
import { UserRepository } from "./UserRepository";
import { UserSettingsRepository } from "./UserSettingsRepository";

export {
  BaseRepository,
  ConversationRepository,
  EmbeddingRepository,
  MessageRepository,
  SessionRepository,
  UserRepository,
  UserSettingsRepository,
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

  private constructor(env: IEnv) {
    this.env = env;
    this.userRepo = new UserRepository(env);
    this.sessionRepo = new SessionRepository(env);
    this.userSettingsRepo = new UserSettingsRepository(env);
    this.conversationRepo = new ConversationRepository(env);
    this.messageRepo = new MessageRepository(env);
    this.embeddingRepo = new EmbeddingRepository(env);
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
}
