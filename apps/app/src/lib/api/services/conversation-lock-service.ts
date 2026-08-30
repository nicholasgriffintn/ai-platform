import {
  createApiErrorFromResponse,
  returnFetchedData,
} from "@ngriffin_uk/polychat-library-client";
import type {
  ConversationLock,
  ConversationLockKeyInput,
  CreateConversationLockInput,
  DeleteConversationLockInput,
  LockedMessage,
  LockedMessageInput,
  SealedEnvelope,
} from "@ngriffin_uk/polychat-schemas";

import { fetchApi } from "../fetch-wrapper";

interface LockResponse {
  lock: ConversationLock;
}

interface LockedMessagesResponse {
  conversation_id: string;
  messages: LockedMessage[];
}

export class ConversationLockService {
  constructor(private getHeaders: () => Promise<Record<string, string>>) {}

  private async request<T>(path: string, init: Parameters<typeof fetchApi>[1], failure: string) {
    let headers: Record<string, string> = {};

    try {
      headers = await this.getHeaders();
    } catch (error) {
      console.error("Error getting headers for a conversation lock request:", error);
    }

    const response = await fetchApi(path, { ...init, headers });

    if (!response.ok) {
      throw await createApiErrorFromResponse(response, failure);
    }

    return returnFetchedData<T>(response);
  }

  async getLock(completionId: string): Promise<ConversationLock> {
    const data = await this.request<LockResponse>(
      `/chat/completions/${completionId}/lock`,
      { method: "GET" },
      "Failed to load the lock for this conversation",
    );

    return data.lock;
  }

  async createLock(
    completionId: string,
    input: CreateConversationLockInput,
  ): Promise<ConversationLock> {
    const data = await this.request<LockResponse>(
      `/chat/completions/${completionId}/lock`,
      { method: "POST", body: input },
      "Failed to lock this conversation",
    );

    return data.lock;
  }

  async deleteLock(completionId: string, input: DeleteConversationLockInput): Promise<void> {
    await this.request<{ success: boolean }>(
      `/chat/completions/${completionId}/lock`,
      { method: "DELETE", body: input },
      "Failed to unlock this conversation",
    );
  }

  async addKey(completionId: string, key: ConversationLockKeyInput): Promise<ConversationLock> {
    const data = await this.request<LockResponse>(
      `/chat/completions/${completionId}/lock/keys`,
      { method: "POST", body: { key } },
      "Failed to add this key",
    );

    return data.lock;
  }

  async deleteKey(completionId: string, keyId: string): Promise<ConversationLock> {
    const data = await this.request<LockResponse>(
      `/chat/completions/${completionId}/lock/keys/${keyId}`,
      { method: "DELETE" },
      "Failed to remove this key",
    );

    return data.lock;
  }

  async listMessages(completionId: string): Promise<LockedMessage[]> {
    const data = await this.request<LockedMessagesResponse>(
      `/chat/completions/${completionId}/locked-messages`,
      { method: "GET" },
      "Failed to load this locked conversation",
    );

    return data.messages;
  }

  async appendMessages(
    completionId: string,
    messages: LockedMessageInput[],
    title?: SealedEnvelope | null,
  ): Promise<LockedMessage[]> {
    const data = await this.request<LockedMessagesResponse>(
      `/chat/completions/${completionId}/locked-messages`,
      {
        method: "POST",
        body: title === undefined ? { messages } : { messages, title },
      },
      "Failed to save this locked message",
    );

    return data.messages;
  }
}
