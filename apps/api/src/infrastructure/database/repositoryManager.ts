import { BaseRepository } from "~/infrastructure/database/BaseRepository";
import { ActivityRepository } from "~/modules/activity/infrastructure/ActivityRepository";
import { ComposioConnectorSessionRepository } from "~/modules/apps/infrastructure/ComposioConnectorSessionRepository";
import { ConnectorOperationApprovalRepository } from "~/modules/apps/infrastructure/ConnectorOperationApprovalRepository";
import { ProviderConnectionRepository } from "~/modules/apps/infrastructure/ProviderConnectionRepository";
import { RecipeComposioTriggerRepository } from "~/modules/apps/infrastructure/RecipeComposioTriggerRepository";
import { AttentionRepository } from "~/modules/attention/infrastructure/AttentionRepository";
import { AuditRepository } from "~/modules/audit/infrastructure/AuditRepository";
import { AuthChallengeRepository } from "~/modules/auth/infrastructure/AuthChallengeRepository";
import { OAuthStateRepository } from "~/modules/auth/infrastructure/OAuthStateRepository";
import { SessionRepository } from "~/modules/auth/infrastructure/SessionRepository";
import { WebAuthnRepository } from "~/modules/auth/infrastructure/WebAuthnRepository";
import { CapabilityConfigurationRepository } from "~/modules/capabilities/infrastructure/CapabilityConfigurationRepository";
import { ChannelBindingRepository } from "~/modules/channels/infrastructure/ChannelBindingRepository";
import { ConversationHandleRepository } from "~/modules/conversations/infrastructure/ConversationHandleRepository";
import { ConversationOrganisationRepository } from "~/modules/conversations/infrastructure/ConversationOrganisationRepository";
import { ConversationRepository } from "~/modules/conversations/infrastructure/ConversationRepository";
import { ConversationRunRepository } from "~/modules/conversations/infrastructure/ConversationRunRepository";
import { MessageRepository } from "~/modules/conversations/infrastructure/MessageRepository";
import { DelegationRepository } from "~/modules/delegations/infrastructure/DelegationRepository";
import { OutboundDeliveryRepository } from "~/modules/delivery/infrastructure/OutboundDeliveryRepository";
import { GoalRepository } from "~/modules/goals/infrastructure/GoalRepository";
import { InfraCostDailyRepository } from "~/modules/infra/infrastructure/InfraCostDailyRepository";
import { MachineRepository } from "~/modules/machines/infrastructure/MachineRepository";
import { MemoryDocumentRepository } from "~/modules/memory-documents/infrastructure/MemoryDocumentRepository";
import { EmbeddingRepository } from "~/modules/memory/infrastructure/EmbeddingRepository";
import { MemorySynthesisRepository } from "~/modules/memory/infrastructure/MemorySynthesisRepository";
import { MobilePushRepository } from "~/modules/mobile-push/infrastructure/MobilePushRepository";
import { ArtificialAnalysisRepository } from "~/modules/model-analysis/infrastructure/ArtificialAnalysisRepository";
import { ModelAssetRepository } from "~/modules/model-registry/infrastructure/ModelAssetRepository";
import { ModelBuildRepository } from "~/modules/model-registry/infrastructure/ModelBuildRepository";
import { ModelEvalRepository } from "~/modules/model-registry/infrastructure/ModelEvalRepository";
import { ModelGovernanceRepository } from "~/modules/model-registry/infrastructure/ModelGovernanceRepository";
import { ModelRouteRepository } from "~/modules/model-registry/infrastructure/ModelRouteRepository";
import { OutputRepository } from "~/modules/outputs/infrastructure/OutputRepository";
import { UserPetRepository } from "~/modules/pets/infrastructure/UserPetRepository";
import { PlanRepository } from "~/modules/plans/infrastructure/PlanRepository";
import { ProjectTaskRepository } from "~/modules/project-tasks/infrastructure/ProjectTaskRepository";
import { SavedMessageRepository } from "~/modules/saved-messages/infrastructure/SavedMessageRepository";
import { AuthoredSkillRepository } from "~/modules/skills/infrastructure/AuthoredSkillRepository";
import { SourceRepository } from "~/modules/sources/infrastructure/SourceRepository";
import { TaskNotificationRepository } from "~/modules/task-notifications/infrastructure/TaskNotificationRepository";
import { TaskRepository } from "~/modules/tasks/infrastructure/TaskRepository";
import { SharedTeammateRepository } from "~/modules/teammates/infrastructure/SharedTeammateRepository";
import { TeammateComputerRepository } from "~/modules/teammates/infrastructure/TeammateComputerRepository";
import { TeammateContextRepository } from "~/modules/teammates/infrastructure/TeammateContextRepository";
import { TeammateFeedbackRepository } from "~/modules/teammates/infrastructure/TeammateFeedbackRepository";
import { TeammateRepository } from "~/modules/teammates/infrastructure/TeammateRepository";
import { TemplateRepository } from "~/modules/templates/infrastructure/TemplateRepository";
import { TrainingExampleRepository } from "~/modules/training/infrastructure/TrainingExampleRepository";
import { UsageBalanceRepository } from "~/modules/usage/infrastructure/UsageBalanceRepository";
import { UsageEventRepository } from "~/modules/usage/infrastructure/UsageEventRepository";
import { UsageReservationRepository } from "~/modules/usage/infrastructure/UsageReservationRepository";
import { AnonymousUserRepository } from "~/modules/user/infrastructure/AnonymousUserRepository";
import { ApiKeyRepository } from "~/modules/user/infrastructure/ApiKeyRepository";
import { UserRepository } from "~/modules/user/infrastructure/UserRepository";
import { UserSettingsRepository } from "~/modules/user/infrastructure/UserSettingsRepository";
import { ProjectEnvironmentVariableRepository } from "~/modules/workspaces/infrastructure/ProjectEnvironmentVariableRepository";
import { WorkspaceProviderConnectionRepository } from "~/modules/workspaces/infrastructure/WorkspaceProviderConnectionRepository";
import { WorkspaceRepository } from "~/modules/workspaces/infrastructure/WorkspaceRepository";
import type { IEnv } from "~/types";

export {
  TeammateRepository,
  TeammateContextRepository,
  TeammateComputerRepository,
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
  ModelAssetRepository,
  ModelBuildRepository,
  ModelEvalRepository,
  ModelGovernanceRepository,
  ModelRouteRepository,
  MessageRepository,
  MachineRepository,
  MobilePushRepository,
  OAuthStateRepository,
  OutboundDeliveryRepository,
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

  public get outboundDeliveries(): OutboundDeliveryRepository {
    return this.resolve("outboundDeliveries", (env) => new OutboundDeliveryRepository(env));
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

  public get teammateContexts(): TeammateContextRepository {
    return this.resolve("teammateContexts", (env) => new TeammateContextRepository(env));
  }

  public get teammateComputers(): TeammateComputerRepository {
    return this.resolve("teammateComputers", (env) => new TeammateComputerRepository(env));
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

  public get modelAssets(): ModelAssetRepository {
    return this.resolve("modelAssets", (env) => new ModelAssetRepository(env));
  }

  public get modelBuilds(): ModelBuildRepository {
    return this.resolve("modelBuilds", (env) => new ModelBuildRepository(env));
  }

  public get modelGovernance(): ModelGovernanceRepository {
    return this.resolve("modelGovernance", (env) => new ModelGovernanceRepository(env));
  }

  public get modelRoutes(): ModelRouteRepository {
    return this.resolve("modelRoutes", (env) => new ModelRouteRepository(env));
  }

  public get modelEvals(): ModelEvalRepository {
    return this.resolve("modelEvals", (env) => new ModelEvalRepository(env));
  }

  public get trainingExamples(): TrainingExampleRepository {
    return this.resolve("trainingExamples", (env) => new TrainingExampleRepository(env));
  }

  public get workspaceProviderConnections(): WorkspaceProviderConnectionRepository {
    return this.resolve(
      "workspaceProviderConnections",
      (env) => new WorkspaceProviderConnectionRepository(env),
    );
  }

  public get workspaces(): WorkspaceRepository {
    return this.resolve("workspaces", (env) => new WorkspaceRepository(env));
  }
}
