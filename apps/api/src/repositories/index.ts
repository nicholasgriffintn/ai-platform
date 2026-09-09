import type { IEnv } from "~/types";

import { ActivityRepository } from "./ActivityRepository";
import { AnonymousUserRepository } from "./AnonymousUserRepository";
import { ApiKeyRepository } from "./ApiKeyRepository";
import { ArtificialAnalysisRepository } from "./ArtificialAnalysisRepository";
import { AttentionRepository } from "./AttentionRepository";
import { AuditRepository } from "./AuditRepository";
import { AuthChallengeRepository } from "./AuthChallengeRepository";
import { AuthoredSkillRepository } from "./AuthoredSkillRepository";
import { BaseRepository } from "./BaseRepository";
import { CapabilityConfigurationRepository } from "./CapabilityConfigurationRepository";
import { ChannelBindingRepository } from "./ChannelBindingRepository";
import { ComposioConnectorSessionRepository } from "./ComposioConnectorSessionRepository";
import { ConnectorOperationApprovalRepository } from "./ConnectorOperationApprovalRepository";
import { ConversationHandleRepository } from "./ConversationHandleRepository";
import { ConversationOrganisationRepository } from "./ConversationOrganisationRepository";
import { ConversationRepository } from "./ConversationRepository";
import { ConversationRunRepository } from "./ConversationRunRepository";
import { DelegationRepository } from "./DelegationRepository";
import { EmbeddingRepository } from "./EmbeddingRepository";
import { GoalRepository } from "./GoalRepository";
import { InfraCostDailyRepository } from "./InfraCostDailyRepository";
import { MachineRepository } from "./MachineRepository";
import { MemoryDocumentRepository } from "./MemoryDocumentRepository";
import { MemorySynthesisRepository } from "./MemorySynthesisRepository";
import { MessageRepository } from "./MessageRepository";
import { MobilePushRepository } from "./MobilePushRepository";
import { OAuthStateRepository } from "./OAuthStateRepository";
import { OutputRepository } from "./OutputRepository";
import { PlanRepository } from "./PlanRepository";
import { ProjectEnvironmentVariableRepository } from "./ProjectEnvironmentVariableRepository";
import { ProjectTaskRepository } from "./ProjectTaskRepository";
import { ProviderConnectionRepository } from "./ProviderConnectionRepository";
import { RecipeComposioTriggerRepository } from "./RecipeComposioTriggerRepository";
import { SavedMessageRepository } from "./SavedMessageRepository";
import { SessionRepository } from "./SessionRepository";
import { SharedTeammateRepository } from "./SharedTeammateRepository";
import { SourceRepository } from "./SourceRepository";
import { TaskNotificationRepository } from "./TaskNotificationRepository";
import { TaskRepository } from "./TaskRepository";
import { TeammateFeedbackRepository } from "./TeammateFeedbackRepository";
import { TeammateRepository } from "./TeammateRepository";
import { TemplateRepository } from "./TemplateRepository";
import { TrainingExampleRepository } from "./TrainingExampleRepository";
import { UsageBalanceRepository } from "./UsageBalanceRepository";
import { UsageEventRepository } from "./UsageEventRepository";
import { UsageReservationRepository } from "./UsageReservationRepository";
import { UserPetRepository } from "./UserPetRepository";
import { UserRepository } from "./UserRepository";
import { UserSettingsRepository } from "./UserSettingsRepository";
import { WebAuthnRepository } from "./WebAuthnRepository";
import { WorkspaceRepository } from "./WorkspaceRepository";

export {
  TeammateRepository,
  ActivityRepository,
  AttentionRepository,
  AnonymousUserRepository,
  ApiKeyRepository,
  ArtificialAnalysisRepository,
  AuthChallengeRepository,
  AuthoredSkillRepository,
  AuditRepository,
  BaseRepository,
  ConversationRepository,
  ConversationRunRepository,
  DelegationRepository,
  ConversationOrganisationRepository,
  CapabilityConfigurationRepository,
  ComposioConnectorSessionRepository,
  ConnectorOperationApprovalRepository,
  EmbeddingRepository,
  GoalRepository,
  InfraCostDailyRepository,
  MemorySynthesisRepository,
  MessageRepository,
  MachineRepository,
  MobilePushRepository,
  OAuthStateRepository,
  OutputRepository,
  SessionRepository,
  TaskRepository,
  TaskNotificationRepository,
  TemplateRepository,
  TrainingExampleRepository,
  UserPetRepository,
  UserRepository,
  UserSettingsRepository,
  UsageBalanceRepository,
  UsageEventRepository,
  UsageReservationRepository,
  WebAuthnRepository,
  PlanRepository,
  ProjectTaskRepository,
  ProjectEnvironmentVariableRepository,
  ProviderConnectionRepository,
  RecipeComposioTriggerRepository,
  SharedTeammateRepository,
  SourceRepository,
  WorkspaceRepository,
};

export class RepositoryManager {
  private readonly env: IEnv;
  private readonly instances = new Map<string, unknown>();

  constructor(env: IEnv) {
    this.env = env;
  }

  public static getInstance(env: IEnv): RepositoryManager {
    return new RepositoryManager(env);
  }

  private resolve<T>(key: string, factory: (env: IEnv) => T): T {
    const existing = this.instances.get(key);

    if (existing) {
      return existing as T;
    }

    const repository = factory(this.env);

    this.instances.set(key, repository);

    return repository;
  }

  public get plans(): PlanRepository {
    return this.resolve("plans", (env) => new PlanRepository(env));
  }

  public get activities(): ActivityRepository {
    return this.resolve("activities", (env) => new ActivityRepository(env));
  }

  public get attention(): AttentionRepository {
    return this.resolve("attention", (env) => new AttentionRepository(env));
  }

  public get projectTasks(): ProjectTaskRepository {
    return this.resolve("projectTasks", (env) => new ProjectTaskRepository(env));
  }

  public get projectEnvironmentVariables(): ProjectEnvironmentVariableRepository {
    return this.resolve(
      "projectEnvironmentVariables",
      (env) => new ProjectEnvironmentVariableRepository(env),
    );
  }

  public get taskNotifications(): TaskNotificationRepository {
    return this.resolve("taskNotifications", (env) => new TaskNotificationRepository(env));
  }

  public get users(): UserRepository {
    return this.resolve("users", (env) => new UserRepository(env));
  }

  public get anonymousUsers(): AnonymousUserRepository {
    return this.resolve("anonymousUsers", (env) => new AnonymousUserRepository(env));
  }

  public get sessions(): SessionRepository {
    return this.resolve("sessions", (env) => new SessionRepository(env));
  }

  public get authChallenges(): AuthChallengeRepository {
    return this.resolve("authChallenges", (env) => new AuthChallengeRepository(env));
  }

  public get authoredSkills(): AuthoredSkillRepository {
    return this.resolve("authoredSkills", (env) => new AuthoredSkillRepository(env));
  }

  public get teammateFeedback(): TeammateFeedbackRepository {
    return this.resolve("teammateFeedback", (env) => new TeammateFeedbackRepository(env));
  }

  public get channelBindings(): ChannelBindingRepository {
    return this.resolve("channelBindings", (env) => new ChannelBindingRepository(env));
  }

  public get memoryDocuments(): MemoryDocumentRepository {
    return this.resolve("memoryDocuments", (env) => new MemoryDocumentRepository(env));
  }

  public get savedMessages(): SavedMessageRepository {
    return this.resolve("savedMessages", (env) => new SavedMessageRepository(env));
  }

  public get audit(): AuditRepository {
    return this.resolve("audit", (env) => new AuditRepository(env));
  }

  public get oauthStates(): OAuthStateRepository {
    return this.resolve("oauthStates", (env) => new OAuthStateRepository(env));
  }

  public get userSettings(): UserSettingsRepository {
    return this.resolve("userSettings", (env) => new UserSettingsRepository(env));
  }

  public get usageEvents(): UsageEventRepository {
    return this.resolve("usageEvents", (env) => new UsageEventRepository(env));
  }

  public get usageBalances(): UsageBalanceRepository {
    return this.resolve("usageBalances", (env) => new UsageBalanceRepository(env));
  }

  public get usageReservations(): UsageReservationRepository {
    return this.resolve("usageReservations", (env) => new UsageReservationRepository(env));
  }

  public get infraCostDaily(): InfraCostDailyRepository {
    return this.resolve("infraCostDaily", (env) => new InfraCostDailyRepository(env));
  }

  public get userPets(): UserPetRepository {
    return this.resolve("userPets", (env) => new UserPetRepository(env));
  }

  public get capabilityConfigurations(): CapabilityConfigurationRepository {
    return this.resolve(
      "capabilityConfigurations",
      (env) => new CapabilityConfigurationRepository(env),
    );
  }

  public get conversations(): ConversationRepository {
    return this.resolve("conversations", (env) => new ConversationRepository(env));
  }

  public get conversationHandles(): ConversationHandleRepository {
    return this.resolve("conversationHandles", (env) => new ConversationHandleRepository(env));
  }

  public get conversationRuns(): ConversationRunRepository {
    return this.resolve("conversationRuns", (env) => new ConversationRunRepository(env));
  }

  public get delegations(): DelegationRepository {
    return this.resolve("delegations", (env) => new DelegationRepository(env));
  }

  public get conversationOrganisation(): ConversationOrganisationRepository {
    return this.resolve(
      "conversationOrganisation",
      (env) => new ConversationOrganisationRepository(env),
    );
  }

  public get goals(): GoalRepository {
    return this.resolve("goals", (env) => new GoalRepository(env));
  }

  public get composioConnectorSessions(): ComposioConnectorSessionRepository {
    return this.resolve(
      "composioConnectorSessions",
      (env) => new ComposioConnectorSessionRepository(env),
    );
  }

  public get connectorOperationApprovals(): ConnectorOperationApprovalRepository {
    return this.resolve(
      "connectorOperationApprovals",
      (env) => new ConnectorOperationApprovalRepository(env),
    );
  }

  public get messages(): MessageRepository {
    return this.resolve("messages", (env) => new MessageRepository(env));
  }

  public get machines(): MachineRepository {
    return this.resolve("machines", (env) => new MachineRepository(env));
  }

  public get mobilePush(): MobilePushRepository {
    return this.resolve("mobilePush", (env) => new MobilePushRepository(env));
  }

  public get embeddings(): EmbeddingRepository {
    return this.resolve("embeddings", (env) => new EmbeddingRepository(env));
  }

  public get webAuthn(): WebAuthnRepository {
    return this.resolve("webAuthn", (env) => new WebAuthnRepository(env));
  }

  public get apiKeys(): ApiKeyRepository {
    return this.resolve("apiKeys", (env) => new ApiKeyRepository(env));
  }

  public get artificialAnalysis(): ArtificialAnalysisRepository {
    return this.resolve("artificialAnalysis", (env) => new ArtificialAnalysisRepository(env));
  }

  public get outputs(): OutputRepository {
    return this.resolve("outputs", (env) => new OutputRepository(env));
  }

  public get providerConnections(): ProviderConnectionRepository {
    return this.resolve("providerConnections", (env) => new ProviderConnectionRepository(env));
  }

  public get recipeComposioTriggers(): RecipeComposioTriggerRepository {
    return this.resolve(
      "recipeComposioTriggers",
      (env) => new RecipeComposioTriggerRepository(env),
    );
  }

  public get templates(): TemplateRepository {
    return this.resolve("templates", (env) => new TemplateRepository(env));
  }

  public get teammates(): TeammateRepository {
    return this.resolve("teammates", (env) => new TeammateRepository(env));
  }

  public get sharedTeammates(): SharedTeammateRepository {
    return this.resolve("sharedTeammates", (env) => new SharedTeammateRepository(env));
  }

  public get sources(): SourceRepository {
    return this.resolve("sources", (env) => new SourceRepository(env));
  }

  public get tasks(): TaskRepository {
    return this.resolve("tasks", (env) => new TaskRepository(env));
  }

  public get memorySyntheses(): MemorySynthesisRepository {
    return this.resolve("memorySyntheses", (env) => new MemorySynthesisRepository(env));
  }

  public get trainingExamples(): TrainingExampleRepository {
    return this.resolve("trainingExamples", (env) => new TrainingExampleRepository(env));
  }

  public get workspaces(): WorkspaceRepository {
    return this.resolve("workspaces", (env) => new WorkspaceRepository(env));
  }
}
