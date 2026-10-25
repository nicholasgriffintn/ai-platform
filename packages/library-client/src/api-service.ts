import type {
  Conversation,
  ConversationActivityWindow,
  ConversationListOptions,
  ConversationListPage,
  Message,
} from "@ngriffin_uk/polychat-library-chat/conversation-types";
import { formatMessageContent } from "@ngriffin_uk/polychat-library-chat/messages";
import type {
  ArtifactBindingReadRequest,
  CreateTeammateGroupInput,
  CreateTeammateInput,
  DeviceAuthorisation,
  DeviceAuthorisationDecision,
  EnqueueChatMessageRequest,
  HireTeammateInput,
  ItemReactionRequest,
  MachineActivity,
  MachineActivityResponse,
  MachineHeartbeat,
  MachineRecord,
  MemoryDocument,
  MessageReaction,
  ModelConfig,
  ModelTiersResponse,
  PolyAgenda,
  PolyHandoffDisagreement,
  PolyLookAround,
  RecordOffPlatformUsageRequest,
  RecordTeammateFeedbackInput,
  SharedTeammateSummary,
  SpendLedger,
  StandingApproval,
  TeammateAutonomyLevel,
  TeammateComputer,
  TeammateComputerAction,
  TeammateConnectionGrant,
  TeammateConnectionGrantListResponse,
  TeammateContext,
  TeammateContextScope,
  TeammateGroup,
  TeammateResponse,
  TeammateRosterEntry,
  Tool,
  ConversationSubject,
  UpdateMemoryDocumentInput,
  UpdatePolyLookAround,
  UpdateTeammateInput,
  UploadFileType,
  UpsertTeammateConnectionGrant,
} from "@ngriffin_uk/polychat-schemas";

import { useChatStore } from "./chatStore.js";
import { AudioService, type SpeechGenerationResponse } from "./services/audio-service.js";
import {
  ConversationsService,
  type ConversationUpdateRequest,
  type GetConversationOptions,
} from "./services/conversations-service.js";
import { DeviceAuthorisationService } from "./services/device-authorisation-service.js";
import { MachineService } from "./services/machine-service.js";
import { PolyService } from "./services/poly-service.js";
import { ResearchService } from "./services/research-service.js";
import { ResponsesService, type CreateResponseParams } from "./services/responses-service.js";
import { SubscriptionService } from "./services/subscription-service.js";
import { TeammateService } from "./services/teammate-service.js";
import { UploadService, type UploadFileOptions } from "./services/upload-service.js";
import { UserService } from "./services/user-service.js";
import type { ConversationShare } from "./shared-conversation.js";
import { useToolsStore } from "./toolsStore.js";
import { getHeaders } from "./utils/headers.js";

class ApiService {
  private static instance: ApiService;

  private conversationsService: ConversationsService;
  private responsesService: ResponsesService;
  private audioService: AudioService;
  private teammateService: TeammateService;
  private userService: UserService;
  private machineService: MachineService;
  private polyService: PolyService;
  private deviceAuthorisationService: DeviceAuthorisationService;
  private subscriptionService: SubscriptionService;
  private uploadService: UploadService;
  private researchService: ResearchService;

  private constructor() {
    this.conversationsService = new ConversationsService(getHeaders);
    this.responsesService = new ResponsesService(getHeaders);
    this.audioService = new AudioService(getHeaders);
    this.teammateService = new TeammateService();
    this.userService = new UserService(getHeaders);
    this.machineService = new MachineService(getHeaders);
    this.polyService = new PolyService(getHeaders);
    this.deviceAuthorisationService = new DeviceAuthorisationService(getHeaders);
    this.subscriptionService = new SubscriptionService();
    this.uploadService = new UploadService(getHeaders);
    this.researchService = new ResearchService();
  }

  public static getInstance(): ApiService {
    if (!ApiService.instance) {
      ApiService.instance = new ApiService();
    }

    return ApiService.instance;
  }

  public getHeaders = getHeaders;

  listChats = (options?: ConversationListOptions): Promise<ConversationListPage> =>
    this.conversationsService.list(options);

  listSubjectConversations = (subject: ConversationSubject) =>
    this.conversationsService.listAboutSubject(subject);

  setAllConversationsArchived = (options: {
    archived: boolean;
    activity?: ConversationActivityWindow;
    query?: string;
    teammateThreads?: "include" | "exclude";
  }): Promise<number> => this.conversationsService.setAllArchived(options);

  getChat = (conversationId: string, options?: GetConversationOptions): Promise<Conversation> =>
    this.conversationsService.get(conversationId, options);

  getEarlierChatMessages = (conversationId: string, beforeMessageId: string, limit?: number) =>
    this.conversationsService.getEarlierMessages(conversationId, beforeMessageId, limit);

  generateTitle = (conversationId: string, messages: Message[]): Promise<string> =>
    this.conversationsService.generateTitle(conversationId, messages);

  compactConversation = (conversationId: string) =>
    this.conversationsService.compact(conversationId);

  getResponse = (responseId: string, signal?: AbortSignal) =>
    this.responsesService.get(responseId, signal);

  getResponseSnapshot = (responseId: string, signal?: AbortSignal) =>
    this.responsesService.getSnapshot(responseId, signal);

  getResponseEvents = (responseId: string, after: number, limit?: number, signal?: AbortSignal) =>
    this.responsesService.getEvents(responseId, after, limit, signal);

  findResponseByIdempotencyKey = (idempotencyKey: string) =>
    this.responsesService.findByIdempotencyKey(idempotencyKey);

  cancelResponse = (responseId: string, expectedAttempt: number, idempotencyKey?: string) =>
    this.responsesService.cancel(responseId, expectedAttempt, idempotencyKey);

  readArtifactBinding = (conversationId: string, input: ArtifactBindingReadRequest) =>
    this.conversationsService.readArtifactBinding(conversationId, input);

  listQueuedChatMessages = (conversationId: string) =>
    this.conversationsService.listQueuedMessages(conversationId);

  queueChatMessage = (conversationId: string, input: EnqueueChatMessageRequest) =>
    this.conversationsService.queueMessage(conversationId, input);

  removeQueuedChatMessage = (conversationId: string, queuedId: string) =>
    this.conversationsService.removeQueuedMessage(conversationId, queuedId);

  getConversationGoal = (conversationId: string) =>
    this.conversationsService.getGoal(conversationId);

  setConversationGoal = (conversationId: string, objective: string, projectId?: string) =>
    this.conversationsService.setGoal(conversationId, objective, projectId);

  updateConversationGoal = (conversationId: string, status: "active" | "paused" | "cleared") =>
    this.conversationsService.updateGoal(conversationId, status);

  updateConversationTitle = (conversationId: string, newTitle: string): Promise<void> =>
    this.conversationsService.updateTitle(conversationId, newTitle);

  updateConversation = (
    conversationId: string,
    updates: ConversationUpdateRequest,
  ): Promise<Conversation> => this.conversationsService.update(conversationId, updates);

  recordOffPlatformRunUsage = (input: RecordOffPlatformUsageRequest): Promise<void> =>
    this.conversationsService.recordOffPlatformRunUsage(input);

  deleteConversation = (conversationId: string): Promise<void> =>
    this.conversationsService.delete(conversationId);

  deleteAllConversations = (): Promise<void> => this.conversationsService.deleteAll();

  shareConversation = (conversationId: string): Promise<ConversationShare> =>
    this.conversationsService.share(conversationId);

  unshareConversation = (conversationId: string): Promise<void> =>
    this.conversationsService.unshare(conversationId);

  reactToItem = (
    conversationId: string,
    request: ItemReactionRequest,
  ): Promise<MessageReaction[]> => this.conversationsService.reactToItem(conversationId, request);

  generateSpeech = (
    input: string,
    options?: { store?: boolean },
  ): Promise<SpeechGenerationResponse> => {
    return this.audioService.generateSpeech(input, options);
  };

  createResponse = async ({
    onProgress,
    ...params
  }: Omit<CreateResponseParams, "selectedTools" | "toolSelectionMode">): Promise<Message> => {
    const { selectedTools, toolSelectionMode } = useToolsStore.getState();
    const { isAuthenticated } = useChatStore.getState();

    const assistantMessage = await this.responsesService.create({
      ...params,
      allowTools: isAuthenticated,
      toolSelectionMode,
      onProgress: (text, reasoning, toolResponses, done, streamedAssistantMessage) => {
        onProgress(text, reasoning, toolResponses, done, streamedAssistantMessage);
      },
      selectedTools,
    });

    if (typeof assistantMessage.content === "string") {
      const { content: formattedContent, reasoning: extractedReasoning } =
        this.formatMessageContent(assistantMessage.content);

      return {
        ...assistantMessage,
        content: formattedContent,
        reasoning: extractedReasoning
          ? {
              collapsed: false,
              content: extractedReasoning,
            }
          : assistantMessage.reasoning,
      };
    }

    return assistantMessage;
  };

  private formatMessageContent(messageContent: string): {
    content: string;
    reasoning: string;
  } {
    return formatMessageContent(messageContent);
  }

  getDeviceAuthorisation = (userCode: string): Promise<DeviceAuthorisation> =>
    this.deviceAuthorisationService.getDeviceAuthorisation(userCode);

  decideDeviceAuthorisation = (
    userCode: string,
    decision: DeviceAuthorisationDecision["decision"],
  ): Promise<{ status: "approved" | "denied" }> =>
    this.deviceAuthorisationService.decideDeviceAuthorisation(userCode, decision);

  readPolyAgenda = (): Promise<PolyAgenda> => this.polyService.readPolyAgenda();

  disagreeWithPolyHandoff = (handoffId: string): Promise<PolyHandoffDisagreement> =>
    this.polyService.disagreeWithPolyHandoff(handoffId);

  setPolyLookAround = (input: UpdatePolyLookAround): Promise<PolyLookAround> =>
    this.polyService.setPolyLookAround(input);

  grantPolyStandingApproval = (interactionId: string): Promise<StandingApproval> =>
    this.polyService.grantPolyStandingApproval(interactionId);

  revokePolyStandingApproval = (toolName: string, destination: string): Promise<void> =>
    this.polyService.revokePolyStandingApproval(toolName, destination);

  listTeammateGroups = (): Promise<TeammateGroup[]> => this.teammateService.listTeammateGroups();

  listTeammateRoster = (): Promise<TeammateRosterEntry[]> =>
    this.teammateService.listTeammateRoster();

  createTeammateGroup = (input: CreateTeammateGroupInput): Promise<TeammateGroup> =>
    this.teammateService.createTeammateGroup(input);

  listTeammates = (): Promise<TeammateResponse[]> => {
    return this.teammateService.listTeammates();
  };

  getTeammate = (teammateId: string): Promise<TeammateResponse> => {
    return this.teammateService.getTeammate(teammateId);
  };

  recordTeammateFeedback = (
    teammateId: string,
    input: RecordTeammateFeedbackInput,
  ): Promise<void> => this.teammateService.recordTeammateFeedback(teammateId, input);

  listTeammateContexts = (teammateId: string): Promise<TeammateContext[]> =>
    this.teammateService.listTeammateContexts(teammateId);

  ensureTeammateContext = (
    teammateId: string,
    scope: TeammateContextScope,
  ): Promise<TeammateContext> => this.teammateService.ensureTeammateContext(teammateId, scope);

  updateTeammateContextAutonomy = (
    contextId: string,
    autonomyLevel: TeammateAutonomyLevel,
  ): Promise<TeammateContext> =>
    this.teammateService.updateTeammateContextAutonomy(contextId, autonomyLevel);

  updateTeammateContextPause = (
    contextId: string,
    pausedUntil: string | null,
  ): Promise<TeammateContext> =>
    this.teammateService.updateTeammateContextPause(contextId, pausedUntil);

  updateTeammateContextBudget = (
    contextId: string,
    monthlyCreditCapMicros: number | null,
  ): Promise<TeammateContext> =>
    this.teammateService.updateTeammateContextBudget(contextId, monthlyCreditCapMicros);

  getTeammateContextSpend = (contextId: string): Promise<SpendLedger> =>
    this.teammateService.getTeammateContextSpend(contextId);

  updateTeammateContextStatus = (
    contextId: string,
    status: TeammateContext["status"],
  ): Promise<TeammateContext> =>
    this.teammateService.updateTeammateContextStatus(contextId, status);

  listTeammateConnectionGrants = (
    contextId: string,
  ): Promise<TeammateConnectionGrantListResponse> =>
    this.teammateService.listTeammateConnectionGrants(contextId);

  upsertTeammateConnectionGrant = (
    contextId: string,
    input: UpsertTeammateConnectionGrant,
  ): Promise<TeammateConnectionGrant> =>
    this.teammateService.upsertTeammateConnectionGrant(contextId, input);

  getTeammateContextMemory = (contextId: string): Promise<MemoryDocument> =>
    this.teammateService.getTeammateContextMemory(contextId);

  updateTeammateContextMemory = (
    contextId: string,
    input: Pick<UpdateMemoryDocumentInput, "content" | "changeNote" | "expectedRevision">,
  ): Promise<MemoryDocument> => this.teammateService.updateTeammateContextMemory(contextId, input);

  getTeammateComputer = (contextId: string): Promise<TeammateComputer> =>
    this.teammateService.getTeammateComputer(contextId);

  performTeammateComputerAction = (contextId: string, action: TeammateComputerAction) =>
    this.teammateService.performTeammateComputerAction(contextId, action);

  takeOverTeammateComputer = (contextId: string, recordTeaching = false) =>
    this.teammateService.takeOverTeammateComputer(contextId, recordTeaching);

  viewTeammateComputer = (contextId: string) =>
    this.teammateService.viewTeammateComputer(contextId);

  releaseTeammateComputer = (contextId: string, fence: number): Promise<TeammateComputer> =>
    this.teammateService.releaseTeammateComputer(contextId, fence);

  publishTeammateToWorkspace = (
    teammateId: string,
    workspaceId: string,
  ): Promise<TeammateResponse> => {
    return this.teammateService.publishTeammateToWorkspace(teammateId, workspaceId);
  };

  listSharedTeammates = (params?: {
    category?: string;
    tags?: string[];
    search?: string;
    featured?: boolean;
    limit?: number;
    offset?: number;
    sort_by?: string;
  }): Promise<SharedTeammateSummary[]> => {
    return this.teammateService.listSharedTeammates(params);
  };

  listFeaturedSharedTeammates = (limit = 10): Promise<SharedTeammateSummary[]> => {
    return this.teammateService.listFeaturedSharedTeammates(limit);
  };

  installSharedTeammate = (sharedTeammateId: string): Promise<unknown> => {
    return this.teammateService.installSharedTeammate(sharedTeammateId);
  };

  getSharedTeammateListingForTeammate = (
    teammateId: string,
  ): Promise<SharedTeammateSummary | null> => {
    return this.teammateService.getSharedTeammateListingForTeammate(teammateId);
  };

  shareTeammate = (
    teammateId: string,
    name: string,
    description?: string | null,
    avatarUrl?: string | null,
    category?: string | null,
    tags?: string[] | null,
  ): Promise<unknown> => {
    return this.teammateService.shareTeammate(
      teammateId,
      name,
      description,
      avatarUrl,
      category,
      tags,
    );
  };

  unshareTeammate = (sharedTeammateId: string): Promise<void> => {
    return this.teammateService.unshareTeammate(sharedTeammateId);
  };

  getSharedCategories = (): Promise<string[]> => {
    return this.teammateService.getSharedCategories();
  };

  getSharedTags = (): Promise<string[]> => {
    return this.teammateService.getSharedTags();
  };

  hireTeammate = (data: HireTeammateInput): Promise<TeammateResponse> => {
    return this.teammateService.hireTeammate(data);
  };

  createTeammate = (data: CreateTeammateInput): Promise<TeammateResponse> => {
    return this.teammateService.createTeammate(data);
  };

  updateTeammate = (teammateId: string, data: UpdateTeammateInput): Promise<TeammateResponse> => {
    return this.teammateService.updateTeammate(teammateId, data);
  };

  deleteTeammate = (teammateId: string): Promise<void> => {
    return this.teammateService.deleteTeammate(teammateId);
  };

  exportChatHistory = (): Promise<Blob> => {
    return this.userService.exportChatHistory();
  };

  fetchModels = (): Promise<ModelConfig> => {
    return this.userService.fetchModels();
  };

  fetchModelTiers = (): Promise<ModelTiersResponse> => {
    return this.userService.fetchModelTiers();
  };

  fetchModelCatalogue = (): Promise<ModelConfig> => {
    return this.userService.fetchModelCatalogue();
  };

  fetchMachines = (): Promise<MachineRecord[]> => {
    return this.machineService.fetchMachines();
  };

  heartbeatMachine = (input: MachineHeartbeat): Promise<MachineRecord | null> => {
    return this.machineService.heartbeat(input);
  };

  forgetMachine = (machineId: string): Promise<void> => {
    return this.machineService.forget(machineId);
  };

  shareMachineActivity = (
    machineId: string,
    input: MachineActivity,
  ): Promise<MachineActivityResponse> => {
    return this.machineService.shareActivity(machineId, input);
  };

  forgetMachineActivity = (machineId: string): Promise<void> => {
    return this.machineService.forgetActivity(machineId);
  };

  fetchTools = (projectId?: string, workspaceId?: string): Promise<Tool[]> => {
    return this.userService.fetchTools(projectId, workspaceId);
  };

  storeProviderApiKey = (
    providerId: string,
    apiKey: string,
    secretKey?: string,
    configuration?: Record<string, unknown>,
  ): Promise<void> => {
    return this.userService.storeProviderApiKey(providerId, apiKey, secretKey, configuration);
  };

  getProviders = () => {
    return this.userService.getProviders();
  };

  deleteProviderApiKey = (providerId: string): Promise<void> => {
    return this.userService.deleteProviderApiKey(providerId);
  };

  syncProviders = (): Promise<void> => {
    return this.userService.syncProviders();
  };

  getUserApiKeys = (): Promise<{ id: string; name: string; created_at: string }[]> => {
    return this.userService.getUserApiKeys();
  };

  createApiKey = (
    name?: string,
  ): Promise<{
    apiKey: string;
    id: string;
    name: string;
    created_at: string;
  }> => {
    return this.userService.createApiKey(name);
  };

  deleteApiKey = (keyId: string): Promise<void> => {
    return this.userService.deleteApiKey(keyId);
  };

  getSubscription = (): Promise<any> => {
    return this.subscriptionService.getSubscription();
  };

  createCheckoutSession = (
    planId: string,
    successUrl: string,
    cancelUrl: string,
  ): Promise<{ url: string }> => {
    return this.subscriptionService.createCheckoutSession(planId, successUrl, cancelUrl);
  };

  cancelSubscription = (): Promise<any> => {
    return this.subscriptionService.cancelSubscription();
  };

  reactivateSubscription = (): Promise<any> => {
    return this.subscriptionService.reactivateSubscription();
  };

  fetchResearchStatus = (runId: string) => {
    return this.researchService.fetchStatus(runId);
  };

  transcribeAudio = (audioBlob: Blob): ReturnType<UploadService["transcribeAudio"]> => {
    return this.uploadService.transcribeAudio(audioBlob);
  };

  uploadFile = (
    file: File,
    fileType: UploadFileType,
    options?: UploadFileOptions,
  ): ReturnType<UploadService["uploadFile"]> => {
    return this.uploadService.uploadFile(file, fileType, options);
  };
}

export const apiService = ApiService.getInstance();
