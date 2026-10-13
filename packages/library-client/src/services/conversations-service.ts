import type {
  Conversation,
  ConversationActivityWindow,
  ConversationListOptions,
  ConversationListPage,
  Message,
} from "@ngriffin_uk/polychat-library-chat/conversation-types";
import {
  compareConversationsBySort,
  conversationActivityCutoff,
} from "@ngriffin_uk/polychat-library-chat/conversations";
import {
  serialiseMessagesForChatRequest,
  serialiseMessagesForConversationUpdate,
} from "@ngriffin_uk/polychat-library-chat/messages";
import {
  artifactBindingReadResponseSchema,
  conversationGroupSchema,
  messagesToItems,
  queuedChatMessageSchema,
  queuedChatMessagesResponseSchema,
  type ArtifactBindingReadRequest,
  type ArtifactBindingReadResponse,
  type EnqueueChatMessageRequest,
  type Goal,
  type ModelTier,
  type PermissionMode,
  type QueuedChatMessage,
  type RecordOffPlatformUsageRequest,
} from "@ngriffin_uk/polychat-schemas";
import { goalSchema } from "@ngriffin_uk/polychat-schemas/goals";
import { sortCopy } from "@ngriffin_uk/polychat-utility-core";

import { parseCompactConversationResponse } from "../compact-conversation-response.js";
import {
  normaliseConversationItems,
  normaliseConversationResponse,
} from "../conversation-response.js";
import { fetchApi, fetchApiOrThrow } from "../fetch-wrapper.js";
import { createApiErrorFromResponse, returnFetchedData } from "../http.js";
import type { ConversationShare } from "../shared-conversation.js";

export interface ConversationUpdateRequest {
  archived?: boolean;
  messages?: Message[];
  parent_conversation_id?: string;
  parent_message_id?: string;
  title?: string;
  permission_mode?: PermissionMode;
}

export interface ConversationCompactionResult {
  compacted: boolean;
  conversation: Conversation;
}

export interface ConversationMessagePage {
  messages: Message[];
  hasMore: boolean;
  oldestMessageId: string | null;
}

export interface GetConversationOptions {
  refreshPending?: boolean;
  messageLimit?: number;
}

function conversationPath(conversationId: string, suffix = ""): string {
  return `/conversations/${encodeURIComponent(conversationId)}${suffix}`;
}

export class ConversationsService {
  constructor(private getHeaders: () => Promise<Record<string, string>>) {}

  private async headers(): Promise<Record<string, string>> {
    try {
      return await this.getHeaders();
    } catch (error) {
      console.error("Error resolving request headers:", error);

      return {};
    }
  }

  async list(options: ConversationListOptions = {}): Promise<ConversationListPage> {
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
    const endpoint = queryString ? `/conversations?${queryString}` : "/conversations";
    const response = await fetchApiOrThrow(endpoint, {
      method: "GET",
      headers: await this.headers(),
    });
    const data = await returnFetchedData<{
      conversations: {
        id: string;
        title: string;
        messages: string[];
        model?: string | null;
        model_tier?: ModelTier | null;
        permission_mode?: PermissionMode;
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
      console.error("Unexpected response format from /conversations endpoint:", data);

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

  async setAllArchived(options: {
    archived: boolean;
    activity?: ConversationActivityWindow;
    query?: string;
  }): Promise<number> {
    const activityCutoff = conversationActivityCutoff(options.activity);
    const response = await fetchApiOrThrow("/conversations/archive", {
      method: "POST",
      headers: await this.headers(),
      body: {
        archived: options.archived,
        q: options.query?.trim() || undefined,
        updated_after: activityCutoff?.toISOString(),
      },
    });
    const data = await returnFetchedData<{ archived?: number }>(response);

    return data.archived ?? 0;
  }

  async get(conversationId: string, options?: GetConversationOptions): Promise<Conversation> {
    if (!conversationId) {
      throw new Error("No conversation ID provided");
    }

    const params = new URLSearchParams();

    if (options?.refreshPending ?? true) {
      params.set("refresh_pending", "true");
    }

    params.set("item_limit", String(options?.messageLimit ?? 100));
    const response = await fetchApi(conversationPath(conversationId, `?${params.toString()}`), {
      method: "GET",
      headers: await this.headers(),
    });

    if (!response.ok) {
      throw await createApiErrorFromResponse(
        response,
        `Failed to get conversation: ${response.statusText}`,
      );
    }

    return normaliseConversationResponse(await returnFetchedData<any>(response), conversationId);
  }

  async getEarlierMessages(
    conversationId: string,
    beforeMessageId: string,
    limit = 100,
  ): Promise<ConversationMessagePage> {
    const query = new URLSearchParams({ before: beforeMessageId, limit: String(limit) });
    const response = await fetchApiOrThrow(
      conversationPath(conversationId, `/items?${query.toString()}`),
      { method: "GET", headers: await this.getHeaders() },
    );
    const data = await returnFetchedData<{
      data?: unknown[];
      has_more?: boolean;
      oldest_item_id?: string | null;
    }>(response);

    return {
      messages: normaliseConversationItems(data.data ?? []),
      hasMore: data.has_more === true,
      oldestMessageId: typeof data.oldest_item_id === "string" ? data.oldest_item_id : null,
    };
  }

  async compact(conversationId: string): Promise<ConversationCompactionResult> {
    if (!conversationId) {
      throw new Error("No conversation ID provided");
    }

    const response = await fetchApiOrThrow("/responses/compact", {
      method: "POST",
      headers: await this.headers(),
      body: { conversation: conversationId },
    });
    const parsed = parseCompactConversationResponse(await returnFetchedData<unknown>(response));

    if (!parsed) {
      throw new Error("Invalid compact conversation response");
    }

    return {
      compacted: parsed.compacted,
      conversation: normaliseConversationResponse(parsed.conversation, conversationId),
    };
  }

  getGoal(conversationId: string): Promise<Goal | null> {
    return this.requestGoal(conversationId, { method: "GET" });
  }

  setGoal(conversationId: string, objective: string, projectId?: string): Promise<Goal | null> {
    return this.requestGoal(conversationId, {
      method: "POST",
      body: JSON.stringify(projectId ? { objective, project_id: projectId } : { objective }),
    });
  }

  updateGoal(
    conversationId: string,
    status: "active" | "paused" | "cleared",
  ): Promise<Goal | null> {
    return this.requestGoal(conversationId, { method: "PATCH", body: JSON.stringify({ status }) });
  }

  private async requestGoal(
    conversationId: string,
    init: { method: string; body?: string },
  ): Promise<Goal | null> {
    if (!conversationId) {
      throw new Error("No conversation ID provided");
    }

    const headers = await this.headers();
    const response = await fetchApiOrThrow(conversationPath(conversationId, "/goal"), {
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

  async generateTitle(conversationId: string, messages: Message[]): Promise<string> {
    if (!conversationId) {
      throw new Error("No conversation ID provided");
    }

    const response = await fetchApi(conversationPath(conversationId, "/title"), {
      method: "POST",
      headers: await this.headers(),
      body: { items: messagesToItems(serialiseMessagesForChatRequest(messages)) },
    });

    if (!response.ok) {
      throw new Error(`Failed to generate title: ${response.statusText}`);
    }

    const data = await returnFetchedData<{ title: string }>(response);

    return data.title;
  }

  async updateTitle(conversationId: string, title: string): Promise<void> {
    await this.update(conversationId, { title });
  }

  async update(conversationId: string, updates: ConversationUpdateRequest): Promise<Conversation> {
    if (!conversationId) {
      throw new Error("No conversation ID provided");
    }

    const { messages, ...rest } = updates;
    const response = await fetchApiOrThrow(conversationPath(conversationId), {
      method: "PATCH",
      headers: await this.headers(),
      body: {
        ...rest,
        ...(messages
          ? { items: messagesToItems(serialiseMessagesForConversationUpdate(messages)) }
          : {}),
      },
    });

    return normaliseConversationResponse(
      await returnFetchedData<Conversation>(response),
      conversationId,
    );
  }

  async recordOffPlatformRunUsage(input: RecordOffPlatformUsageRequest): Promise<void> {
    await fetchApiOrThrow("/user/usage/off-platform", {
      method: "POST",
      headers: await this.headers(),
      body: input,
    });
  }

  async delete(conversationId: string): Promise<void> {
    if (!conversationId) {
      throw new Error("No conversation ID provided");
    }

    const response = await fetchApi(conversationPath(conversationId), {
      method: "DELETE",
      headers: await this.headers(),
    });

    if (!response.ok) {
      throw new Error(`Failed to delete conversation: ${response.statusText}`);
    }
  }

  async deleteAll(): Promise<void> {
    const response = await fetchApi("/conversations", {
      method: "DELETE",
      headers: await this.headers(),
    });

    if (!response.ok) {
      throw new Error(`Failed to delete all conversations: ${response.statusText}`);
    }
  }

  async share(conversationId: string): Promise<ConversationShare> {
    if (!conversationId) {
      throw new Error("No conversation ID provided");
    }

    const response = await fetchApi(conversationPath(conversationId, "/share"), {
      method: "POST",
      headers: await this.headers(),
    });

    if (!response.ok) {
      throw new Error(`Failed to share conversation: ${response.statusText}`);
    }

    return returnFetchedData<ConversationShare>(response);
  }

  async unshare(conversationId: string): Promise<void> {
    if (!conversationId) {
      throw new Error("No conversation ID provided");
    }

    const response = await fetchApi(conversationPath(conversationId, "/share"), {
      method: "DELETE",
      headers: await this.headers(),
    });

    if (!response.ok) {
      throw new Error(`Failed to unshare conversation: ${response.statusText}`);
    }
  }

  async submitFeedback(conversationId: string, itemId: string, feedback: 1 | -1): Promise<void> {
    if (!conversationId || !itemId) {
      throw new Error("No conversation or item ID provided");
    }

    const response = await fetchApi(conversationPath(conversationId, "/feedback"), {
      method: "POST",
      headers: await this.headers(),
      body: { item_id: itemId, feedback },
    });

    if (!response.ok) {
      throw new Error(`Failed to submit feedback: ${response.statusText}`);
    }
  }

  async readArtifactBinding(
    conversationId: string,
    input: ArtifactBindingReadRequest,
  ): Promise<ArtifactBindingReadResponse> {
    const response = await fetchApiOrThrow(
      conversationPath(conversationId, "/artifact-bindings/read"),
      { method: "POST", headers: await this.getHeaders(), body: input },
    );

    return artifactBindingReadResponseSchema.parse(await returnFetchedData<unknown>(response));
  }

  async listQueuedMessages(conversationId: string): Promise<QueuedChatMessage[]> {
    const response = await fetchApiOrThrow(conversationPath(conversationId, "/queue"), {
      method: "GET",
      headers: await this.getHeaders(),
    });

    return queuedChatMessagesResponseSchema.parse(await returnFetchedData<unknown>(response))
      .messages;
  }

  async queueMessage(
    conversationId: string,
    input: EnqueueChatMessageRequest,
  ): Promise<QueuedChatMessage> {
    const response = await fetchApiOrThrow(conversationPath(conversationId, "/queue"), {
      method: "POST",
      headers: await this.getHeaders(),
      body: input,
    });

    return queuedChatMessageSchema.parse(await returnFetchedData<unknown>(response));
  }

  async removeQueuedMessage(conversationId: string, queuedId: string): Promise<void> {
    await fetchApiOrThrow(
      conversationPath(conversationId, `/queue/${encodeURIComponent(queuedId)}`),
      { method: "DELETE", headers: await this.getHeaders() },
    );
  }
}
