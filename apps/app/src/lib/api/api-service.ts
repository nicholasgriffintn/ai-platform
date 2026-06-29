import { useToolsStore } from "~/state/stores/toolsStore";
import { useChatStore } from "~/state/stores/chatStore";
import type {
	CreateAgentInput,
	MarkdownConversionOptions,
	ModelConfig,
	UpdateAgentInput,
} from "@assistant/schemas";
import type { Conversation, ConversationListOptions, ConversationListPage, Message } from "~/types";
import { formatMessageContent } from "../messages";
import { AgentService } from "./services/agent-service";
import { AudioService, type SpeechGenerationResponse } from "./services/audio-service";
import {
	ChatService,
	type ConversationUpdateRequest,
	type StreamChatCompletionsParams,
} from "./services/chat-service";
import { ResearchService } from "./services/research-service";
import { SubscriptionService } from "./services/subscription-service";
import { UploadService } from "./services/upload-service";
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
	private agentService: AgentService;
	private userService: UserService;
	private subscriptionService: SubscriptionService;
	private uploadService: UploadService;
	private researchService: ResearchService;

	private constructor() {
		this.chatService = new ChatService(getHeaders);
		this.audioService = new AudioService(getHeaders);
		this.agentService = new AgentService(getHeaders);
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

	getChat = (
		completion_id: string,
		options?: { refreshPending?: boolean },
	): Promise<Conversation> => {
		return this.chatService.getChat(completion_id, options);
	};

	generateTitle = (completion_id: string, messages: Message[]): Promise<string> => {
		return this.chatService.generateTitle(completion_id, messages);
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

	submitFeedback = (
		completion_id: string,
		log_id: string,
		feedback: 1 | -1,
		score = 50,
	): Promise<void> => {
		return this.chatService.submitFeedback(completion_id, log_id, feedback, score);
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
	}: Omit<StreamChatCompletionsParams, "selectedTools">): Promise<Message> => {
		const { selectedTools } = useToolsStore.getState();
		const { isPro } = useChatStore.getState();

		const assistantMessage = await this.chatService.streamChatCompletions({
			...params,
			allowTools: isPro,
			onProgress: (text, reasoning, toolResponses, done, assistantMessage) => {
				onProgress(text, reasoning, toolResponses, done, assistantMessage);
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

	// ===== Agent Methods =====

	listAgents = (): Promise<any[]> => {
		return this.agentService.listAgents();
	};

	listSharedAgents = (params?: {
		category?: string;
		tags?: string[];
		search?: string;
		featured?: boolean;
		limit?: number;
		offset?: number;
		sort_by?: string;
	}): Promise<any[]> => {
		return this.agentService.listSharedAgents(params);
	};

	listFeaturedSharedAgents = (limit = 10): Promise<any[]> => {
		return this.agentService.listFeaturedSharedAgents(limit);
	};

	installSharedAgent = (agentId: string): Promise<any> => {
		return this.agentService.installSharedAgent(agentId);
	};

	shareAgent = (
		agentId: string,
		name: string,
		description?: string | null,
		avatarUrl?: string | null,
		category?: string | null,
		tags?: string[] | null,
	): Promise<any> => {
		return this.agentService.shareAgent(agentId, name, description, avatarUrl, category, tags);
	};

	rateSharedAgent = (agentId: string, rating: number, review?: string): Promise<any> => {
		return this.agentService.rateSharedAgent(agentId, rating, review);
	};

	getAgentRatings = (agentId: string, limit = 10): Promise<any[]> => {
		return this.agentService.getAgentRatings(agentId, limit);
	};

	getSharedCategories = (): Promise<string[]> => {
		return this.agentService.getSharedCategories();
	};

	getSharedTags = (): Promise<string[]> => {
		return this.agentService.getSharedTags();
	};

	createAgent = (data: CreateAgentInput): Promise<any> => {
		return this.agentService.createAgent(data);
	};

	updateAgent = (agentId: string, data: UpdateAgentInput): Promise<void> => {
		return this.agentService.updateAgent(agentId, data);
	};

	deleteAgent = (agentId: string): Promise<void> => {
		return this.agentService.deleteAgent(agentId);
	};

	// ===== User/Settings Methods =====

	exportChatHistory = (): Promise<Blob> => {
		return this.userService.exportChatHistory();
	};

	fetchModels = (): Promise<ModelConfig> => {
		return this.userService.fetchModels();
	};

	fetchTools = (): Promise<any> => {
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

	transcribeAudio = (audioBlob: Blob): Promise<any> => {
		return this.uploadService.transcribeAudio(audioBlob);
	};

	uploadFile = (
		file: File,
		fileType: "image" | "document" | "audio" | "code",
		options?: {
			convertToMarkdown?: boolean;
			conversionOptions?: MarkdownConversionOptions;
		},
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
