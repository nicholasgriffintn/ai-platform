import { formatMessageContent } from "@ngriffin_uk/polychat-library-chat/messages";
import type {
  TeammateResponse,
  CreateTeammateInput,
  HireTeammateInput,
  SharedTeammateSummary,
  ModelConfig,
  Tool,
  UpdateTeammateInput,
} from "@ngriffin_uk/polychat-schemas";

import { useChatStore } from "~/state/stores/chatStore";
import { useToolsStore } from "~/state/stores/toolsStore";
import type {
  Conversation,
  ConversationActivityWindow,
  ConversationListOptions,
  ConversationListPage,
  Message,
} from "~/types";

import { AudioService, type SpeechGenerationResponse } from "./services/audio-service";
import {
  ChatService,
  type ConversationUpdateRequest,
  type GetChatOptions,
  type StreamChatCompletionsParams,
} from "./services/chat-service";
import { ResearchService } from "./services/research-service";
import { SubscriptionService } from "./services/subscription-service";
import { TeammateService } from "./services/teammate-service";
import { UploadService, type UploadFileOptions } from "./services/upload-service";
import type { ProviderSetting } from "./services/user-service";
import { UserService } from "./services/user-service";
import { getHeaders } from "./utils/headers";

/**
 * Main API service class that acts as a facade for all domain-specific services.
 * This provides a single entry point for all API operations while delegating
 * to specialized services internally.
 */
class ApiService {
  private static instance: ApiService;

  private chatService: ChatService;
  private audioService: AudioService;
  private teammateService: TeammateService;
  private userService: UserService;
  private subscriptionService: SubscriptionService;
  private uploadService: UploadService;
  private researchService: ResearchService;

  private constructor() {
    this.chatService = new ChatService(getHeaders);
    this.audioService = new AudioService(getHeaders);
    this.teammateService = new TeammateService(getHeaders);
    this.userService = new UserService(getHeaders);
    this.subscriptionService = new SubscriptionService();
    this.uploadService = new UploadService(getHeaders);
    this.researchService = new ResearchService(getHeaders);
  }

  public static getInstance(): ApiService {
    if (!ApiService.instance) {
      ApiService.instance = new ApiService();
    }

    return ApiService.instance;
  }

  public getHeaders = getHeaders;

  // ===== Chat/Conversation Methods =====

  listChats = (options?: ConversationListOptions): Promise<ConversationListPage> => {
    return this.chatService.listChats(options);
  };

  setAllConversationsArchived = (options: {
    archived: boolean;
    activity?: ConversationActivityWindow;
    query?: string;
  }): Promise<number> => {
    return this.chatService.setAllConversationsArchived(options);
  };

  getChat = (completion_id: string, options?: GetChatOptions): Promise<Conversation> => {
    return this.chatService.getChat(completion_id, options);
  };

  getEarlierChatMessages = (completionId: string, beforeMessageId: string, limit?: number) =>
    this.chatService.getEarlierChatMessages(completionId, beforeMessageId, limit);

  generateTitle = (completion_id: string, messages: Message[]): Promise<string> => {
    return this.chatService.generateTitle(completion_id, messages);
  };

  compactConversation = (completion_id: string) => {
    return this.chatService.compactConversation(completion_id);
  };

  async cancelChatCompletion(completion_id: string): Promise<void> {
    return this.chatService.cancelChatCompletion(completion_id);
  }

  getChatRun = (runId: string, signal?: AbortSignal) => this.chatService.getChatRun(runId, signal);

  getChatRunSnapshot = (runId: string, signal?: AbortSignal) =>
    this.chatService.getChatRunSnapshot(runId, signal);

  getChatRunEvents = (runId: string, after: number, limit?: number, signal?: AbortSignal) =>
    this.chatService.getChatRunEvents(runId, after, limit, signal);

  getChatRunCommand = (commandId: string) => this.chatService.getChatRunCommand(commandId);

  cancelChatRun = (runId: string, expectedAttempt: number, commandId?: string) =>
    this.chatService.cancelChatRun(runId, expectedAttempt, commandId);

  getConversationGoal = (completion_id: string) => {
    return this.chatService.getConversationGoal(completion_id);
  };

  setConversationGoal = (completion_id: string, objective: string, projectId?: string) => {
    return this.chatService.setConversationGoal(completion_id, objective, projectId);
  };

  updateConversationGoal = (completion_id: string, status: "active" | "paused" | "cleared") => {
    return this.chatService.updateConversationGoal(completion_id, status);
  };

  updateConversationTitle = (completion_id: string, newTitle: string): Promise<void> => {
    return this.chatService.updateConversationTitle(completion_id, newTitle);
  };

  updateConversation = (
    completion_id: string,
    updates: ConversationUpdateRequest,
  ): Promise<Conversation> => {
    return this.chatService.updateConversation(completion_id, updates);
  };

  deleteConversation = (completion_id: string): Promise<void> => {
    return this.chatService.deleteConversation(completion_id);
  };

  deleteAllConversations = (): Promise<void> => {
    return this.chatService.deleteAllConversations();
  };

  shareConversation = (completion_id: string): Promise<{ share_id: string }> => {
    return this.chatService.shareConversation(completion_id);
  };

  unshareConversation = (completion_id: string): Promise<void> => {
    return this.chatService.unshareConversation(completion_id);
  };

  submitFeedback = (completion_id: string, log_id: string, feedback: 1 | -1): Promise<void> => {
    return this.chatService.submitFeedback(completion_id, log_id, feedback);
  };

  generateSpeech = (
    input: string,
    options?: { store?: boolean },
  ): Promise<SpeechGenerationResponse> => {
    return this.audioService.generateSpeech(input, options);
  };

  streamChatCompletions = async ({
    onProgress,
    ...params
  }: Omit<
    StreamChatCompletionsParams,
    "selectedTools" | "toolSelectionMode"
  >): Promise<Message> => {
    const { selectedTools, toolSelectionMode } = useToolsStore.getState();
    const { isAuthenticated } = useChatStore.getState();

    const assistantMessage = await this.chatService.streamChatCompletions({
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

  // ===== Teammate Methods =====

  listTeammates = (): Promise<TeammateResponse[]> => {
    return this.teammateService.listTeammates();
  };

  getTeammate = (teammateId: string): Promise<TeammateResponse> => {
    return this.teammateService.getTeammate(teammateId);
  };

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

  // ===== User/Settings Methods =====

  exportChatHistory = (): Promise<Blob> => {
    return this.userService.exportChatHistory();
  };

  fetchModels = (): Promise<ModelConfig> => {
    return this.userService.fetchModels();
  };

  fetchModelCatalogue = (): Promise<ModelConfig> => {
    return this.userService.fetchModelCatalogue();
  };

  fetchTools = (): Promise<Tool[]> => {
    return this.userService.fetchTools();
  };

  storeProviderApiKey = (
    providerId: string,
    apiKey: string,
    secretKey?: string,
    configuration?: Record<string, unknown>,
  ): Promise<void> => {
    return this.userService.storeProviderApiKey(providerId, apiKey, secretKey, configuration);
  };

  getProviderSettings = (): Promise<ProviderSetting[]> => {
    return this.userService.getProviderSettings();
  };

  getProviderSyncStatus = () => {
    return this.userService.getProviderSyncStatus();
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

  // ===== Subscription Methods =====

  getSubscription = (): Promise<any | null> => {
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

  // ===== Research Methods =====

  fetchResearchStatus = (runId: string, provider?: string) => {
    return this.researchService.fetchStatus(runId, provider);
  };

  // ===== Upload Methods =====

  transcribeAudio = (audioBlob: Blob): ReturnType<UploadService["transcribeAudio"]> => {
    return this.uploadService.transcribeAudio(audioBlob);
  };

  uploadFile = (
    file: File,
    fileType: "image" | "document" | "audio" | "code",
    options?: UploadFileOptions,
  ): Promise<{
    url: string;
    type: string;
    name: string;
    markdown?: string;
  }> => {
    return this.uploadService.uploadFile(file, fileType, options);
  };
}

export const apiService = ApiService.getInstance();
