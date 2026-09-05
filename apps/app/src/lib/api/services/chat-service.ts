import {
  compareConversationsBySort,
  conversationActivityCutoff,
} from "@ngriffin_uk/polychat-library-chat/conversations";
import { readCompactionStatusMessage } from "@ngriffin_uk/polychat-library-chat/message-compaction-status";
import {
  getMessageTextContent,
  serialiseMessagesForChatRequest,
  serialiseMessagesForConversationUpdate,
} from "@ngriffin_uk/polychat-library-chat/messages";
import { filterUnavailableModelToolSelections } from "@ngriffin_uk/polychat-library-chat/model-tools";
import {
  ApiError,
  createApiErrorFromResponse,
  returnFetchedData,
} from "@ngriffin_uk/polychat-library-client";
import {
  chatRunCommandReceiptResponseSchema,
  chatRunRecoveryResponseSchema,
  chatRunReplayResponseSchema,
  chatRunSnapshotResponseSchema,
  conversationGroupSchema,
  type ChatCompletionResponseBody,
  type ChatRun,
  type ChatRunCommandReceipt,
  type ChatRunSnapshotResponse,
  type Goal,
  type ModelConfigItem,
  type ModelRouterMode,
  type ToolSelectionMode,
} from "@ngriffin_uk/polychat-schemas";
import {
  CHAT_STREAM_PROGRESS_BATCH_EVENTS,
  createChatStreamAssembler,
  isChatStreamProgressEvent,
  parseChatStreamSseBuffer,
  type ChatStreamUpdate,
  type ParsedChatStreamSseEvent,
} from "@ngriffin_uk/polychat-schemas/chat-stream";
import { goalSchema } from "@ngriffin_uk/polychat-schemas/goals";
import { normaliseToolIds } from "@ngriffin_uk/polychat-schemas/tool-ids";
import { isRecord, sortCopy } from "@ngriffin_uk/polychat-utility-core";

import { yieldToMainThread } from "~/lib/async/yield-to-main-thread";
import type { AppChatRunReplayResponse, AuthoritativeChatRunSnapshot } from "~/lib/chat/run-replay";
import { getSandboxTaskToolNames } from "~/lib/sandbox/task-tools";
import type {
  ChatMode,
  ChatRequestOptions,
  ChatSettings,
  Conversation,
  ConversationActivityWindow,
  ConversationListOptions,
  ConversationListPage,
  Message,
} from "~/types";

import { projectChatRequestSettings } from "../chat-request-settings";
import {
  createStreamingApiError,
  toAppMessage,
  toCompletionResponseAppMessage,
} from "../chat-stream-response";
import { parseCompactConversationResponse } from "../compact-conversation-response";
import { normaliseConversationResponse } from "../conversation-response";
import { fetchApi, fetchApiOrThrow } from "../fetch-wrapper";
import { appendRecoveryTelemetry, type RecoveryRequestContext } from "../recovery-telemetry";

export interface ConversationUpdateRequest {
  archived?: boolean;
  messages?: Message[];
  parent_conversation_id?: string;
  parent_message_id?: string;
  title?: string;
}

export interface ConversationCompactionResult {
  compacted: boolean;
  conversation: Conversation;
}

export interface ChatRunSnapshot {
  run: ChatRun;
  messages: Message[];
}

export interface ConversationMessagePage {
  messages: Message[];
  hasMore: boolean;
  oldestMessageId: string | null;
}

function normaliseRunSnapshot(snapshot: ChatRunSnapshotResponse): AuthoritativeChatRunSnapshot {
  return {
    ...snapshot,
    messages: normaliseConversationResponse(
      { id: snapshot.run.conversationId, messages: snapshot.messages },
      snapshot.run.conversationId,
    ).messages,
  };
}

export interface GetChatOptions {
  recovery?: RecoveryRequestContext;
  refreshPending?: boolean;
  messageLimit?: number;
}

type StreamProgressHandler = (
  text: string,
  reasoning?: string,
  toolResponses?: Message[],
  done?: boolean,
  assistantMessage?: Message,
) => void;

export interface StreamChatCompletionsParams {
  allowTools?: boolean;
  chatSettings: ChatSettings;
  completionId: string;
  endpoint?: string;
  messages: Message[];
  mode: ChatMode;
  model?: string;
  modelConfig?: ModelConfigItem;
  modelRouterMode?: ModelRouterMode;
  models?: string[];
  onProgress: StreamProgressHandler;
  onStateChange: (state: string, data?: any) => void;
  provider?: string;
  requestOptions?: ChatRequestOptions;
  selectedTools?: string[];
  signal: AbortSignal;
  toolSelectionMode?: ToolSelectionMode;
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

    const params = new URLSearchParams();

    if (options.limit) {
      params.set("limit", String(options.limit));
    }

    if (options.page) {
      params.set("page", String(options.page));
    }

    if (options.archived) {
      params.set("archived", options.archived);
    }

    const activityCutoff = conversationActivityCutoff(options.activity);

    if (activityCutoff) {
      params.set("updated_after", activityCutoff.toISOString());
    }

    if (options.sortBy) {
      params.set("sort_by", options.sortBy);
    }

    if (options.query?.trim()) {
      params.set("q", options.query.trim());
    }

    const queryString = params.toString();
    const endpoint = queryString ? `/chat/completions?${queryString}` : "/chat/completions";

    const response = await fetchApiOrThrow(endpoint, {
      method: "GET",
      headers,
    });

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
        is_pinned?: number;
        is_unread?: number;
        next_response_arrived?: number;
        group?: string | object | null;
      }[];
      pageNumber?: number;
      pageSize?: number;
      total?: number;
      totalPages?: number;
    }>(response);

    if (!data.conversations || !Array.isArray(data.conversations)) {
      console.error("Unexpected response format from /chat/completions endpoint:", data);

      return {
        conversations: [],
        pageNumber: options.page ?? 1,
        pageSize: options.limit ?? 25,
        total: 0,
        totalPages: 0,
      };
    }

    const results = data.conversations.map((conversation) => {
      let group: unknown = conversation.group ?? null;

      if (typeof group === "string") {
        try {
          group = JSON.parse(group);
        } catch {
          group = null;
        }
      }

      const parsedGroup = conversationGroupSchema.nullable().safeParse(group);

      return {
        ...conversation,
        messages: [],
        parent_conversation_id: conversation.parent_conversation_id,
        parent_message_id: conversation.parent_message_id,
        isPinned: conversation.is_pinned === 1,
        isUnread: conversation.is_unread === 1 || conversation.next_response_arrived === 1,
        group: parsedGroup.success ? parsedGroup.data : null,
      };
    });

    const sortBy = options.sortBy ?? "updated";
    const conversations = sortCopy(
      results,
      (a, b) => Number(b.isPinned) - Number(a.isPinned) || compareConversationsBySort(a, b, sortBy),
    );

    return {
      conversations,
      pageNumber: data.pageNumber ?? options.page ?? 1,
      pageSize: data.pageSize ?? options.limit ?? 25,
      total: data.total ?? conversations.length,
      totalPages: data.totalPages ?? 0,
    };
  }

  async setAllConversationsArchived(options: {
    archived: boolean;
    activity?: ConversationActivityWindow;
    query?: string;
  }): Promise<number> {
    let headers = {};

    try {
      headers = await this.getHeaders();
    } catch (error) {
      console.error("Error archiving conversations:", error);
    }

    const activityCutoff = conversationActivityCutoff(options.activity);

    const response = await fetchApiOrThrow("/chat/completions", {
      method: "PATCH",
      headers,
      body: {
        archived: options.archived,
        q: options.query?.trim() || undefined,
        updated_after: activityCutoff?.toISOString(),
      },
    });

    const data = await returnFetchedData<{ archived?: number }>(response);

    return data.archived ?? 0;
  }

  async getChat(completion_id: string, options?: GetChatOptions): Promise<Conversation> {
    if (!completion_id) {
      throw new Error("No completion ID provided");
    }

    let headers = {};

    try {
      headers = await this.getHeaders();
    } catch (error) {
      console.error("Error getting chat:", error);
    }

    const params = new URLSearchParams();

    if (options?.refreshPending ?? true) {
      params.set("refresh_pending", "true");
    }

    params.set("message_limit", String(options?.messageLimit ?? 100));
    appendRecoveryTelemetry(params, options?.recovery);

    const query = params.toString();
    const url = `/chat/completions/${completion_id}${query ? `?${query}` : ""}`;

    const response = await fetchApi(url, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      throw await createApiErrorFromResponse(
        response,
        `Failed to get chat: ${response.statusText}`,
      );
    }

    const conversation = await returnFetchedData<any>(response);

    return normaliseConversationResponse(conversation, completion_id);
  }

  async getEarlierChatMessages(
    completionId: string,
    beforeMessageId: string,
    limit = 100,
  ): Promise<ConversationMessagePage> {
    const query = new URLSearchParams({
      before: beforeMessageId,
      limit: String(limit),
    });
    const response = await fetchApiOrThrow(
      `/chat/completions/${completionId}/messages?${query.toString()}`,
      { method: "GET", headers: await this.getHeaders() },
    );
    const data = await returnFetchedData<{
      messages?: unknown[];
      has_more?: boolean;
      oldest_message_id?: string | null;
    }>(response);
    const messages = normaliseConversationResponse(
      { id: completionId, messages: data.messages },
      completionId,
    ).messages;

    return {
      messages,
      hasMore: data.has_more === true,
      oldestMessageId: typeof data.oldest_message_id === "string" ? data.oldest_message_id : null,
    };
  }

  async compactConversation(completion_id: string): Promise<ConversationCompactionResult> {
    if (!completion_id) {
      throw new Error("No completion ID provided");
    }

    let headers = {};

    try {
      headers = await this.getHeaders();
    } catch (error) {
      console.error("Error compacting chat:", error);
    }

    const response = await fetchApiOrThrow(`/chat/completions/${completion_id}/compact`, {
      method: "POST",
      headers,
    });
    const parsed = parseCompactConversationResponse(await returnFetchedData<unknown>(response));

    if (!parsed) {
      throw new Error("Invalid compact conversation response");
    }

    return {
      compacted: parsed.compacted,
      conversation: normaliseConversationResponse(parsed.conversation, completion_id),
    };
  }

  async getConversationGoal(completion_id: string): Promise<Goal | null> {
    return this.requestGoal(completion_id, { method: "GET" });
  }

  async setConversationGoal(
    completion_id: string,
    objective: string,
    projectId?: string,
  ): Promise<Goal | null> {
    return this.requestGoal(completion_id, {
      method: "POST",
      body: JSON.stringify(projectId ? { objective, project_id: projectId } : { objective }),
    });
  }

  async updateConversationGoal(
    completion_id: string,
    status: "active" | "paused" | "cleared",
  ): Promise<Goal | null> {
    return this.requestGoal(completion_id, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
  }

  private async requestGoal(
    completion_id: string,
    init: { method: string; body?: string },
  ): Promise<Goal | null> {
    if (!completion_id) {
      throw new Error("No completion ID provided");
    }

    let headers: Record<string, string> = {};

    try {
      headers = await this.getHeaders();
    } catch (error) {
      console.error("Error resolving goal request headers:", error);
    }

    const response = await fetchApiOrThrow(`/chat/completions/${completion_id}/goal`, {
      ...init,
      headers: init.body ? { ...headers, "Content-Type": "application/json" } : headers,
    });
    const data = await returnFetchedData<{ goal?: unknown }>(response);
    const parsed = goalSchema.nullable().safeParse(data?.goal ?? null);

    if (!parsed.success) {
      console.error("Unexpected goal response shape", parsed.error.issues);

      throw new Error("Could not read the goal for this conversation");
    }

    return parsed.data;
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

    return normaliseConversationResponse(data, completion_id);
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

  async cancelChatCompletion(completion_id: string): Promise<void> {
    if (!completion_id) {
      return;
    }

    let headers = {};

    try {
      headers = await this.getHeaders();
    } catch (error) {
      console.error("Error cancelling chat completion:", error);
    }

    await fetchApi(`/chat/completions/${completion_id}/cancel`, {
      method: "POST",
      headers: { ...headers, "X-Platform": "web" },
    });
  }

  async getChatRun(runId: string, recovery?: RecoveryRequestContext): Promise<ChatRunSnapshot> {
    const params = new URLSearchParams();

    appendRecoveryTelemetry(params, recovery);

    const query = params.toString();
    const response = await fetchApiOrThrow(`/chat/runs/${runId}${query ? `?${query}` : ""}`, {
      method: "GET",
      headers: await this.getHeaders(),
    });
    const parsed = chatRunRecoveryResponseSchema.parse(await returnFetchedData<unknown>(response));

    return {
      run: parsed.run,
      messages: normaliseConversationResponse(
        { id: parsed.run.conversationId, messages: parsed.messages },
        parsed.run.conversationId,
      ).messages,
    };
  }

  async getChatRunSnapshot(runId: string): Promise<AuthoritativeChatRunSnapshot> {
    const response = await fetchApiOrThrow(`/chat/runs/${runId}/snapshot`, {
      method: "GET",
      headers: await this.getHeaders(),
    });
    const parsed = chatRunSnapshotResponseSchema.parse(await returnFetchedData<unknown>(response));

    return normaliseRunSnapshot(parsed);
  }

  async getChatRunEvents(
    runId: string,
    after: number,
    limit = 100,
  ): Promise<AppChatRunReplayResponse> {
    const query = new URLSearchParams({ after: String(after), limit: String(limit) });
    const response = await fetchApiOrThrow(`/chat/runs/${runId}/events?${query.toString()}`, {
      method: "GET",
      headers: await this.getHeaders(),
    });
    const parsed = chatRunReplayResponseSchema.parse(await returnFetchedData<unknown>(response));

    return {
      ...parsed,
      snapshot: parsed.snapshot ? normaliseRunSnapshot(parsed.snapshot) : null,
    };
  }

  async getChatRunCommand(commandId: string): Promise<ChatRunCommandReceipt> {
    const response = await fetchApiOrThrow(`/chat/run-commands/${commandId}`, {
      method: "GET",
      headers: await this.getHeaders(),
    });
    const parsed = chatRunCommandReceiptResponseSchema.parse(
      await returnFetchedData<unknown>(response),
    );

    return parsed.run;
  }

  async cancelChatRun(
    runId: string,
    expectedAttempt: number,
    commandId: string = crypto.randomUUID(),
  ): Promise<ChatRunCommandReceipt> {
    const response = await fetchApiOrThrow(`/chat/runs/${runId}/cancel`, {
      method: "POST",
      headers: await this.getHeaders(),
      body: { command_id: commandId, expected_attempt: expectedAttempt },
    });
    const parsed = chatRunCommandReceiptResponseSchema.parse(
      await returnFetchedData<unknown>(response),
    );

    return parsed.run;
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

  async submitFeedback(completion_id: string, log_id: string, feedback: 1 | -1): Promise<void> {
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
    modelRouterMode,
    models,
    onProgress,
    onStateChange,
    provider,
    requestOptions,
    selectedTools,
    signal,
    store = true,
    toolSelectionMode,
    streamingEnabled = true,
    useMultiModel = false,
    allowTools = true,
  }: StreamChatCompletionsParams): Promise<Message> {
    let headers = {};

    try {
      headers = await this.getHeaders();
    } catch (error) {
      console.error("Error streaming chat completions:", error);
    }

    const formattedMessages = serialiseMessagesForChatRequest(messages);

    if (formattedMessages.length === 0) {
      throw new Error("Missing required parameter: messages");
    }

    const sandboxOptions =
      allowTools && requestOptions?.options?.sandbox?.enabled
        ? requestOptions.options.sandbox
        : undefined;
    const selectedToolIds =
      allowTools && selectedTools
        ? normaliseToolIds(filterUnavailableModelToolSelections(selectedTools, modelConfig))
        : undefined;
    const requestEnabledTools = sandboxOptions
      ? normaliseToolIds([...(selectedToolIds ?? []), ...getSandboxTaskToolNames()])
      : selectedToolIds;
    const requestApprovedTools = sandboxOptions ? getSandboxTaskToolNames() : undefined;

    const {
      enabledTools: settingsEnabledTools,
      generationSettings,
      hostedToolOptions,
    } = projectChatRequestSettings(chatSettings);
    const enabledTools = allowTools ? (requestEnabledTools ?? settingsEnabledTools) : undefined;
    const { options: featureOptions, ...requestOptionFields } = requestOptions ?? {};
    const requestBody: Record<string, any> = {
      ...requestOptionFields,
      command_id: requestOptionFields.command_id ?? crypto.randomUUID(),
      completion_id: completionId,
      messages: formattedMessages,
      platform: "web",
      store,
      stream: streamingEnabled,
      ...generationSettings,
      models,
      model_router_mode: modelRouterMode,
      provider,
      mode,
      use_multi_model: useMultiModel,
      max_steps: sandboxOptions?.maxSteps ?? (sandboxOptions ? 2 : undefined),
      enabled_tools: enabledTools,
      tool_selection_mode: allowTools ? toolSelectionMode : undefined,
      approved_tools: allowTools ? requestApprovedTools : undefined,
      tool_options: allowTools ? hostedToolOptions : undefined,
      options: featureOptions,
    };

    if (model !== undefined) {
      requestBody.model = model;
    }

    const response = await fetchApi(endpoint, {
      method: "POST",
      headers,
      body: requestBody,
      signal,
    });

    if (!response.ok) {
      throw await createApiErrorFromResponse(response, "Failed to stream chat completions");
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
      const data = await returnFetchedData<ChatCompletionResponseBody>(response);

      if ("error" in data) {
        const error = data.error;

        throw new Error(
          isRecord(error) && typeof error.message === "string" ? error.message : "Unknown error",
        );
      }

      const compactionMessage = readCompactionStatusMessage(
        data.post_processing?.compaction?.message,
      );

      if (compactionMessage) {
        onStateChange("compaction", {
          type: "state",
          state: "compaction",
          message: compactionMessage,
        });
      }

      if (data.run) {
        onStateChange("run", {
          type: "state",
          state: "run",
          receipt: data.run satisfies ChatRunCommandReceipt,
        });
      }

      return toCompletionResponseAppMessage(data, model);
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
      if (update.type === "assistant_metadata") {
        onProgress(
          typeof update.message.content === "string" ? update.message.content : "",
          update.message.reasoning?.content,
          undefined,
          false,
          toAppMessage(update.message),
        );

        return;
      }

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

      if (update.type === "activity") {
        onStateChange("turn_activity", update.activity);

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

      if (parsedData.type === "usage" && "usage" in parsedData) {
        onStateChange("usage", parsedData);
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

    const processBufferedEvents = async (flush = false) => {
      const parsed = parseChatStreamSseBuffer(buffer, { flush });

      buffer = parsed.remainingBuffer;
      let progressEventsSinceYield = 0;

      for (const parsedData of parsed.events) {
        try {
          handleParsedEvent(parsedData);
        } catch (error) {
          if (error instanceof ApiError) {
            throw error;
          }

          console.error("Error handling SSE data:", error, parsedData);
        }

        if (!isChatStreamProgressEvent(parsedData)) {
          progressEventsSinceYield = 0;
          continue;
        }

        progressEventsSinceYield += 1;

        if (progressEventsSinceYield >= CHAT_STREAM_PROGRESS_BATCH_EVENTS) {
          progressEventsSinceYield = 0;
          await yieldToMainThread();
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
        await processBufferedEvents();
      }

      if (buffer.trim()) {
        await processBufferedEvents(true);
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
