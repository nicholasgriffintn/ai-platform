import type { IEnv } from "~/types";

import { ActivityRepository } from "./ActivityRepository";
import { AgentRepository } from "./AgentRepository";
import { AnonymousUserRepository } from "./AnonymousUserRepository";
import { ApiKeyRepository } from "./ApiKeyRepository";
import { ArtificialAnalysisRepository } from "./ArtificialAnalysisRepository";
import { AuditRepository } from "./AuditRepository";
import { AuthChallengeRepository } from "./AuthChallengeRepository";
import { BaseRepository } from "./BaseRepository";
import { CapabilityConfigurationRepository } from "./CapabilityConfigurationRepository";
import { ComposioConnectorSessionRepository } from "./ComposioConnectorSessionRepository";
import { ConnectorOperationApprovalRepository } from "./ConnectorOperationApprovalRepository";
import { ConversationRepository } from "./ConversationRepository";
import { EmbeddingRepository } from "./EmbeddingRepository";
import { GoalRepository } from "./GoalRepository";
import { MemorySynthesisRepository } from "./MemorySynthesisRepository";
import { MessageRepository } from "./MessageRepository";
import { OAuthStateRepository } from "./OAuthStateRepository";
import { OutputRepository } from "./OutputRepository";
import { PlanRepository } from "./PlanRepository";
import { ProjectTaskRepository } from "./ProjectTaskRepository";
import { ProviderConnectionRepository } from "./ProviderConnectionRepository";
import { RecipeComposioTriggerRepository } from "./RecipeComposioTriggerRepository";
import { SessionRepository } from "./SessionRepository";
import { SharedAgentRepository } from "./SharedAgentRepository";
import { SourceRepository } from "./SourceRepository";
import { TaskRepository } from "./TaskRepository";
import { TemplateRepository } from "./TemplateRepository";
import { TrainingExampleRepository } from "./TrainingExampleRepository";
import { UserPetRepository } from "./UserPetRepository";
import { UserRepository } from "./UserRepository";
import { UserSettingsRepository } from "./UserSettingsRepository";
import { WebAuthnRepository } from "./WebAuthnRepository";
import { WorkspaceRepository } from "./WorkspaceRepository";

export {
  AgentRepository,
  ActivityRepository,
  AnonymousUserRepository,
  ApiKeyRepository,
  ArtificialAnalysisRepository,
  AuthChallengeRepository,
  AuditRepository,
  BaseRepository,
  ConversationRepository,
  CapabilityConfigurationRepository,
  ComposioConnectorSessionRepository,
  ConnectorOperationApprovalRepository,
  EmbeddingRepository,
  GoalRepository,
  MemorySynthesisRepository,
  MessageRepository,
  OAuthStateRepository,
  OutputRepository,
  SessionRepository,
  TaskRepository,
  TemplateRepository,
  TrainingExampleRepository,
  UserPetRepository,
  UserRepository,
  UserSettingsRepository,
  WebAuthnRepository,
  PlanRepository,
  ProjectTaskRepository,
  ProviderConnectionRepository,
  RecipeComposioTriggerRepository,
  SharedAgentRepository,
  SourceRepository,
  WorkspaceRepository,
};

export class RepositoryManager {
  private activityRepo: ActivityRepository;
  private agentRepo: AgentRepository;
  private planRepo: PlanRepository;
  private projectTaskRepo: ProjectTaskRepository;
  private userRepo: UserRepository;
  private anonymousUserRepo: AnonymousUserRepository;
  private sessionRepo: SessionRepository;
  private userSettingsRepo: UserSettingsRepository;
  private userPetRepo: UserPetRepository;
  private capabilityConfigurationRepo: CapabilityConfigurationRepository;
  private conversationRepo: ConversationRepository;
  private composioConnectorSessionRepo: ComposioConnectorSessionRepository;
  private connectorOperationApprovalRepo: ConnectorOperationApprovalRepository;
  private messageRepo: MessageRepository;
  private embeddingRepo: EmbeddingRepository;
  private goalRepo: GoalRepository;
  private webAuthnRepo: WebAuthnRepository;
  private apiKeyRepo: ApiKeyRepository;
  private artificialAnalysisRepo: ArtificialAnalysisRepository;
  private authChallengeRepo: AuthChallengeRepository;
  private auditRepo: AuditRepository;
  private oauthStateRepo: OAuthStateRepository;
  private outputRepo: OutputRepository;
  private providerConnectionRepo: ProviderConnectionRepository;
  private recipeComposioTriggerRepo: RecipeComposioTriggerRepository;
  private sharedAgentRepo: SharedAgentRepository;
  private sourceRepo: SourceRepository;
  private taskRepo: TaskRepository;
  private templateRepo: TemplateRepository;
  private memorySynthesisRepo: MemorySynthesisRepository;
  private trainingExampleRepo: TrainingExampleRepository;
  private workspaceRepo: WorkspaceRepository;

  constructor(env: IEnv) {
    this.activityRepo = new ActivityRepository(env);
    this.agentRepo = new AgentRepository(env);
    this.planRepo = new PlanRepository(env);
    this.projectTaskRepo = new ProjectTaskRepository(env);
    this.userRepo = new UserRepository(env);
    this.anonymousUserRepo = new AnonymousUserRepository(env);
    this.sessionRepo = new SessionRepository(env);
    this.userSettingsRepo = new UserSettingsRepository(env);
    this.userPetRepo = new UserPetRepository(env);
    this.capabilityConfigurationRepo = new CapabilityConfigurationRepository(env);
    this.conversationRepo = new ConversationRepository(env);
    this.composioConnectorSessionRepo = new ComposioConnectorSessionRepository(env);
    this.connectorOperationApprovalRepo = new ConnectorOperationApprovalRepository(env);
    this.messageRepo = new MessageRepository(env);
    this.embeddingRepo = new EmbeddingRepository(env);
    this.goalRepo = new GoalRepository(env);
    this.webAuthnRepo = new WebAuthnRepository(env);
    this.apiKeyRepo = new ApiKeyRepository(env);
    this.artificialAnalysisRepo = new ArtificialAnalysisRepository(env);
    this.authChallengeRepo = new AuthChallengeRepository(env);
    this.auditRepo = new AuditRepository(env);
    this.oauthStateRepo = new OAuthStateRepository(env);
    this.outputRepo = new OutputRepository(env);
    this.providerConnectionRepo = new ProviderConnectionRepository(env);
    this.recipeComposioTriggerRepo = new RecipeComposioTriggerRepository(env);
    this.sharedAgentRepo = new SharedAgentRepository(env);
    this.sourceRepo = new SourceRepository(env);
    this.taskRepo = new TaskRepository(env);
    this.templateRepo = new TemplateRepository(env);
    this.memorySynthesisRepo = new MemorySynthesisRepository(env);
    this.trainingExampleRepo = new TrainingExampleRepository(env);
    this.workspaceRepo = new WorkspaceRepository(env);
  }

  public static getInstance(env: IEnv): RepositoryManager {
    return new RepositoryManager(env);
  }

  public get plans(): PlanRepository {
    return this.planRepo;
  }

  public get activities(): ActivityRepository {
    return this.activityRepo;
  }

  public get projectTasks(): ProjectTaskRepository {
    return this.projectTaskRepo;
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

  public get authChallenges(): AuthChallengeRepository {
    return this.authChallengeRepo;
  }

  public get audit(): AuditRepository {
    return this.auditRepo;
  }

  public get oauthStates(): OAuthStateRepository {
    return this.oauthStateRepo;
  }

  public get userSettings(): UserSettingsRepository {
    return this.userSettingsRepo;
  }

  public get userPets(): UserPetRepository {
    return this.userPetRepo;
  }

  public get capabilityConfigurations(): CapabilityConfigurationRepository {
    return this.capabilityConfigurationRepo;
  }

  public get conversations(): ConversationRepository {
    return this.conversationRepo;
  }

  public get goals(): GoalRepository {
    return this.goalRepo;
  }

  public get composioConnectorSessions(): ComposioConnectorSessionRepository {
    return this.composioConnectorSessionRepo;
  }

  public get connectorOperationApprovals(): ConnectorOperationApprovalRepository {
    return this.connectorOperationApprovalRepo;
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

  public get apiKeys(): ApiKeyRepository {
    return this.apiKeyRepo;
  }

  public get artificialAnalysis(): ArtificialAnalysisRepository {
    return this.artificialAnalysisRepo;
  }

  public get outputs(): OutputRepository {
    return this.outputRepo;
  }

  public get providerConnections(): ProviderConnectionRepository {
    return this.providerConnectionRepo;
  }

  public get recipeComposioTriggers(): RecipeComposioTriggerRepository {
    return this.recipeComposioTriggerRepo;
  }

  public get templates(): TemplateRepository {
    return this.templateRepo;
  }

  public get agents(): AgentRepository {
    return this.agentRepo;
  }

  public get sharedAgents(): SharedAgentRepository {
    return this.sharedAgentRepo;
  }

  public get sources(): SourceRepository {
    return this.sourceRepo;
  }

  public get tasks(): TaskRepository {
    return this.taskRepo;
  }

  public get memorySyntheses(): MemorySynthesisRepository {
    return this.memorySynthesisRepo;
  }

  public get trainingExamples(): TrainingExampleRepository {
    return this.trainingExampleRepo;
  }

  public get workspaces(): WorkspaceRepository {
    return this.workspaceRepo;
  }
}
