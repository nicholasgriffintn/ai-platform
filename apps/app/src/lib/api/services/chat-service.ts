import type {
	ChatMode,
	ChatRequestOptions,
	ChatSettings,
	Conversation,
	ConversationListOptions,
	ConversationListPage,
	Message,
} from "~/types";
import {
	createChatStreamAssembler,
	normaliseToolIds,
	parseChatStreamSseBuffer,
	type ChatStreamUpdate,
	type ParsedChatStreamSseEvent,
} from "@assistant/schemas";
import type { ModelConfigItem } from "@assistant/schemas";
import { getSandboxModeToolNames } from "~/lib/sandbox/chat-mode";
import { filterUnavailableModelToolSelections } from "~/lib/model-tools";
import {
	getMessageTextContent,
	normalizeMessage,
	serialiseMessagesForChatRequest,
	serialiseMessagesForConversationUpdate,
} from "../../messages";
import { createStreamingApiError, toAppMessage } from "../chat-stream-response";
import { ApiError, fetchApi, fetchApiOrThrow, returnFetchedData } from "../fetch-wrapper";

export interface ConversationUpdateRequest {
	archived?: boolean;
	messages?: Message[];
	parent_conversation_id?: string;
	parent_message_id?: string;
	title?: string;
}

type StreamProgressHandler = (
	text: string,
	reasoning?: string,
	toolResponses?: Message[],
	done?: boolean,
	assistantMessage?: Message,
) => void;

export interface StreamChatCompletionsParams {
	chatSettings: ChatSettings;
	completionId: string;
	endpoint?: string;
	messages: Message[];
	mode: ChatMode;
	model?: string;
	modelConfig?: ModelConfigItem;
	models?: string[];
	onProgress: StreamProgressHandler;
	onStateChange: (state: string, data?: any) => void;
	provider?: string;
	requestOptions?: ChatRequestOptions;
	selectedTools?: string[];
	signal: AbortSignal;
	store?: boolean;
	streamingEnabled?: boolean;
	useMultiModel?: boolean;
}

export class ChatService {
	constructor(private getHeaders: () => Promise<Record<string, string>>) {}

	async listChats(options: ConversationListOptions = {}): Promise<ConversationListPage> {
		let headers = {};
		try {
			headers = await this.getHeaders();
		} catch (error) {
			console.error("Error listing chats:", error);
		}

		try {
			const params = new URLSearchParams();
			if (options.limit) params.set("limit", String(options.limit));
			if (options.page) params.set("page", String(options.page));
			if (options.archived) params.set("archived", options.archived);
			if (options.sortBy) params.set("sort_by", options.sortBy);
			if (options.query?.trim()) params.set("q", options.query.trim());

			const queryString = params.toString();
			const endpoint = queryString ? `/chat/completions?${queryString}` : "/chat/completions";

			const response = await fetchApi(endpoint, {
				method: "GET",
				headers,
			});

			if (!response.ok) {
				throw new Error(`Failed to list chats: ${response.statusText}`);
			}

			const data = await returnFetchedData<{
				conversations: {
					id: string;
					title: string;
					messages: string[];
					created_at?: string;
					updated_at?: string;
					last_message_at: string;
					parent_conversation_id?: string;
					parent_message_id?: string;
					is_archived?: boolean;
				}[];
				pageNumber?: number;
				pageSize?: number;
				totalPages?: number;
			}>(response);

			if (!data.conversations || !Array.isArray(data.conversations)) {
				console.error("Unexpected response format from /chat/completions endpoint:", data);
				return {
					conversations: [],
					pageNumber: options.page ?? 1,
					pageSize: options.limit ?? 25,
					totalPages: 0,
				};
			}

			const results = data.conversations.map((conversation) => ({
				...conversation,
				messages: [],
				message_ids: conversation.messages,
				parent_conversation_id: conversation.parent_conversation_id,
				parent_message_id: conversation.parent_message_id,
			}));

			const conversations = results.sort((a, b) => {
				const dateField = options.sortBy === "created" ? "created_at" : "updated_at";
				const aTimestamp = new Date(a[dateField] || a.last_message_at).getTime();
				const bTimestamp = new Date(b[dateField] || b.last_message_at).getTime();
				return bTimestamp - aTimestamp;
			});

			return {
				conversations,
				pageNumber: data.pageNumber ?? options.page ?? 1,
				pageSize: data.pageSize ?? options.limit ?? 25,
				totalPages: data.totalPages ?? 0,
			};
		} catch (error) {
			console.error("Error listing chats:", error);
			return {
				conversations: [],
				pageNumber: options.page ?? 1,
				pageSize: options.limit ?? 25,
				totalPages: 0,
			};
		}
	}

	async getChat(
		completion_id: string,
		options?: { refreshPending?: boolean },
	): Promise<Conversation> {
		if (!completion_id) {
			throw new Error("No completion ID provided");
		}

		let headers = {};
		try {
			headers = await this.getHeaders();
		} catch (error) {
			console.error("Error getting chat:", error);
		}

		const refreshPending = options?.refreshPending ?? true;
		const url = refreshPending
			? `/chat/completions/${completion_id}?refresh_pending=true`
			: `/chat/completions/${completion_id}`;

		const response = await fetchApi(url, {
			method: "GET",
			headers,
		});

		if (!response.ok) {
			throw new Error(`Failed to get chat: ${response.statusText}`);
		}

		const conversation = await returnFetchedData<any>(response);

		if (!conversation.id) {
			return {
				id: completion_id,
				title: "New conversation",
				messages: [],
			};
		}

		const messages = conversation.messages;

		const transformedMessages = messages.map((msg: any) => normalizeMessage(msg));

		return {
			id: completion_id,
			title: conversation.title,
			messages: transformedMessages,
			is_public: conversation.is_public,
			share_id: conversation.share_id,
			parent_conversation_id: conversation.parent_conversation_id,
			parent_message_id: conversation.parent_message_id,
		};
	}

	async generateTitle(completion_id: string, messages: Message[]): Promise<string> {
		if (!completion_id) {
			throw new Error("No completion ID provided");
		}

		let headers = {};
		try {
			headers = await this.getHeaders();
		} catch (error) {
			console.error("Error generating title:", error);
		}

		const formattedMessages = serialiseMessagesForChatRequest(messages);

		const response = await fetchApi(`/chat/completions/${completion_id}/generate-title`, {
			method: "POST",
			headers,
			body: {
				completion_id,
				messages: formattedMessages,
			},
		});

		if (!response.ok) {
			throw new Error(`Failed to generate title: ${response.statusText}`);
		}

		const data = await returnFetchedData<any>(response);
		return data.title;
	}

	async updateConversationTitle(completion_id: string, newTitle: string): Promise<void> {
		await this.updateConversation(completion_id, { title: newTitle });
	}

	async updateConversation(
		completion_id: string,
		updates: ConversationUpdateRequest,
	): Promise<Conversation> {
		if (!completion_id) {
			throw new Error("No completion ID provided");
		}

		let headers = {};
		try {
			headers = await this.getHeaders();
		} catch (error) {
			console.error("Error updating conversation:", error);
		}

		const updateResponse = await fetchApiOrThrow(`/chat/completions/${completion_id}`, {
			method: "PUT",
			headers,
			body: {
				completion_id,
				...updates,
				messages: updates.messages
					? serialiseMessagesForConversationUpdate(updates.messages)
					: undefined,
			},
		});

		const data = await returnFetchedData<Conversation>(updateResponse);
		return {
			...data,
			id: data.id || completion_id,
			messages: Array.isArray(data.messages)
				? data.messages.map((message) => normalizeMessage(message))
				: [],
		};
	}

	async deleteConversation(completion_id: string): Promise<void> {
		if (!completion_id) {
			throw new Error("No completion ID provided");
		}

		let headers = {};
		try {
			headers = await this.getHeaders();
		} catch (error) {
			console.error("Error deleting conversation:", error);
		}

		const response = await fetchApi(`/chat/completions/${completion_id}`, {
			method: "DELETE",
			headers,
		});

		if (!response.ok) {
			throw new Error(`Failed to delete chat: ${response.statusText}`);
		}
	}

	async deleteAllConversations(): Promise<void> {
		let headers = {};
		try {
			headers = await this.getHeaders();
		} catch (error) {
			console.error("Error deleting all conversations:", error);
		}

		const response = await fetchApi("/chat/completions", {
			method: "DELETE",
			headers,
		});

		if (!response.ok) {
			throw new Error(`Failed to delete all conversations: ${response.statusText}`);
		}
	}

	async shareConversation(completion_id: string): Promise<{ share_id: string }> {
		if (!completion_id) {
			throw new Error("No completion ID provided");
		}

		let headers = {};
		try {
			headers = await this.getHeaders();
		} catch (error) {
			console.error("Error sharing conversation:", error);
		}

		const response = await fetchApi(`/chat/completions/${completion_id}/share`, {
			method: "POST",
			headers,
		});

		if (!response.ok) {
			throw new Error(`Failed to share conversation: ${response.statusText}`);
		}

		return await returnFetchedData<{ share_id: string }>(response);
	}

	async unshareConversation(completion_id: string): Promise<void> {
		if (!completion_id) {
			throw new Error("No completion ID provided");
		}

		let headers = {};
		try {
			headers = await this.getHeaders();
		} catch (error) {
			console.error("Error unsharing conversation:", error);
		}

		const response = await fetchApi(`/chat/completions/${completion_id}/share`, {
			method: "DELETE",
			headers,
		});

		if (!response.ok) {
			throw new Error(`Failed to unshare conversation: ${response.statusText}`);
		}
	}

	async submitFeedback(
		completion_id: string,
		log_id: string,
		feedback: 1 | -1,
		score = 50,
	): Promise<void> {
		if (!completion_id) {
			throw new Error("No completion ID provided");
		}

		let headers = {};
		try {
			headers = await this.getHeaders();
		} catch (error) {
			console.error("Error submitting feedback:", error);
		}

		const response = await fetchApi(`/chat/completions/${completion_id}/feedback`, {
			method: "POST",
			headers,
			body: {
				log_id,
				feedback,
				score,
			},
		});

		if (!response.ok) {
			throw new Error(`Failed to submit feedback: ${response.statusText}`);
		}
	}

	async streamChatCompletions({
		chatSettings,
		completionId,
		endpoint = "/chat/completions",
		messages,
		mode,
		model,
		modelConfig,
		models,
		onProgress,
		onStateChange,
		provider,
		requestOptions,
		selectedTools,
		signal,
		store = true,
		streamingEnabled = true,
		useMultiModel = false,
	}: StreamChatCompletionsParams): Promise<Message> {
		let headers = {};
		try {
			headers = await this.getHeaders();
		} catch (error) {
			console.error("Error streaming chat completions:", error);
		}

		const formattedMessages = serialiseMessagesForChatRequest(messages);
		const sandboxOptions = requestOptions?.sandbox?.enabled ? requestOptions.sandbox : undefined;
		const selectedToolIds = selectedTools
			? normaliseToolIds(filterUnavailableModelToolSelections(selectedTools, modelConfig))
			: undefined;
		const requestEnabledTools = sandboxOptions
			? normaliseToolIds([
					...(selectedToolIds ?? []),
					...getSandboxModeToolNames(sandboxOptions.taskType),
				])
			: selectedToolIds;
		const requestApprovedTools = sandboxOptions
			? getSandboxModeToolNames(sandboxOptions.taskType)
			: undefined;

		const { tool_options: _toolOptions, ...requestSettings } = chatSettings;
		const requestBody: Record<string, any> = {
			...requestSettings,
			completion_id: completionId,
			mode,
			messages: formattedMessages,
			platform: "web",
			store,
			stream: streamingEnabled,
			enabled_tools: requestEnabledTools,
			approved_tools: requestApprovedTools,
			max_steps: sandboxOptions?.maxSteps ?? (sandboxOptions ? 2 : undefined),
			use_multi_model: useMultiModel,
			options: {
				...chatSettings.tool_options,
				...requestOptions,
			},
		};

		if (model !== undefined) {
			requestBody.model = model;
		}
		if (models?.length) {
			requestBody.models = models;
		}
		if (provider !== undefined) {
			requestBody.provider = provider;
		}

		const response = await fetchApi(endpoint, {
			method: "POST",
			headers,
			body: requestBody,
			signal,
		});

		if (!response.ok) {
			throw new Error(`Failed to stream chat completions: ${response.statusText}`);
		}

		return this.processStreamingResponse(response, model, onProgress, onStateChange);
	}

	private async processStreamingResponse(
		response: Response,
		model: string | undefined,
		onProgress: (
			text: string,
			reasoning?: string,
			toolResponses?: Message[],
			done?: boolean,
			assistantMessage?: Message,
		) => void,
		onStateChange: (state: string, data?: any) => void,
	): Promise<Message> {
		const isStreamingResponse = response.headers.get("content-type")?.includes("text/event-stream");

		if (!isStreamingResponse) {
			const data = await returnFetchedData<any>(response);

			if (data.error) {
				throw new Error(data.error.message || "Unknown error");
			}

			return normalizeMessage({
				role: "assistant",
				content: data.choices?.[0]?.message?.content || "",
				data: data.choices?.[0]?.message?.data || undefined,
				reasoning: data.choices?.[0]?.message?.reasoning || undefined,
				id: data.id || crypto.randomUUID(),
				created: data.created || Date.now(),
				model,
				citations: data.choices?.[0]?.message?.citations || null,
				usage: data.usage || undefined,
				tool_calls: data.choices?.[0]?.message?.tool_calls || undefined,
				log_id: data.log_id || undefined,
			});
		}

		const decoder = new TextDecoder();
		const reader = response.body?.getReader();
		if (!reader) {
			throw new Error("Response body is not readable as a stream");
		}

		let buffer = "";
		let lastAssistantMessage: Message | undefined;
		const assembler = createChatStreamAssembler({ model });

		const handleUpdate = (update: ChatStreamUpdate) => {
			if (update.type === "assistant_delta") {
				onProgress(update.content, update.reasoning, undefined, false);
				return;
			}

			if (update.type === "assistant_final") {
				lastAssistantMessage = toAppMessage(update.message);
				onProgress(
					getMessageTextContent(lastAssistantMessage),
					lastAssistantMessage.reasoning?.content,
					undefined,
					true,
					lastAssistantMessage,
				);
				return;
			}

			if (update.type === "tool_result") {
				onProgress("", "", [toAppMessage(update.message)]);
				return;
			}

			if (update.type === "state") {
				onStateChange(update.state, update.event);
				return;
			}

			if (update.type === "done" && update.message) {
				lastAssistantMessage = toAppMessage(update.message);
			}
		};
		const handleParsedEvent = (parsedData: ParsedChatStreamSseEvent) => {
			if (parsedData.type === "error" && "error" in parsedData) {
				throw createStreamingApiError(parsedData.error);
			}
			if (parsedData.type === "usage_limits" && "usage_limits" in parsedData) {
				onStateChange("usage_limits", parsedData.usage_limits);
			}
			if (parsedData.type === "tool_use_start") {
				onStateChange("tool_use_start", parsedData);
			}
			if (parsedData.type === "tool_use_stop") {
				onStateChange("tool_use_stop", parsedData);
			}

			for (const update of assembler.ingest(parsedData)) {
				handleUpdate(update);
			}
		};
		const processBufferedEvents = (flush = false) => {
			const parsed = parseChatStreamSseBuffer(buffer, { flush });
			buffer = parsed.remainingBuffer;

			for (const parsedData of parsed.events) {
				try {
					handleParsedEvent(parsedData);
				} catch (error) {
					if (error instanceof ApiError) {
						throw error;
					}
					console.error("Error handling SSE data:", error, parsedData);
				}
			}
		};

		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) {
					break;
				}

				buffer += decoder.decode(value, { stream: true });
				processBufferedEvents();
			}

			if (buffer.trim()) {
				processBufferedEvents(true);
			}

			if (!assembler.getFinalMessage()) {
				for (const update of assembler.ingest({ type: "done" })) {
					handleUpdate(update);
				}
			}
		} catch (error) {
			console.error("Error reading stream:", error);
			if (error instanceof Error && error.name !== "AbortError") {
				throw error;
			}
		} finally {
			reader.releaseLock();
		}

		const finalStreamMessage = assembler.getFinalMessage();
		return (
			lastAssistantMessage ||
			(finalStreamMessage
				? toAppMessage(finalStreamMessage)
				: toAppMessage({
						role: "assistant",
						content: "",
						id: crypto.randomUUID(),
						model,
					}))
		);
	}
}
