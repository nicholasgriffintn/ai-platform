import { apiKeyService } from "~/lib/api/api-key";
import { useChatStore } from "~/state/stores/chatStore";
import { useToolsStore } from "~/state/stores/toolsStore";
import { useUsageStore } from "~/state/stores/usageStore";
import type {
  ChatMode,
  ChatSettings,
  Conversation,
  Message,
  ModelConfig,
} from "~/types";
import { formatMessageContent, normalizeMessage } from "../messages";
import { fetchApi } from "./fetch-wrapper";

class ApiService {
  private static instance: ApiService;

  private constructor() {}

  public static getInstance(): ApiService {
    if (!ApiService.instance) {
      ApiService.instance = new ApiService();
    }
    return ApiService.instance;
  }

  public getHeaders = async (): Promise<Record<string, string>> => {
    try {
      const { turnstileToken } = useChatStore.getState();

      const headers: Record<string, string> = {
        "X-Turnstile-Token": turnstileToken || "na",
      };

      const apiKey = await apiKeyService.getApiKey();
      if (apiKey) {
        headers.Authorization = `Bearer ${apiKey}`;
      }

      return headers;
    } catch (error) {
      console.error("Error getting headers:", error);
      return {};
    }
  };

  listChats = async (): Promise<Conversation[]> => {
    let headers = {};
    try {
      headers = await this.getHeaders();
    } catch (error) {
      console.error("Error listing chats:", error);
    }

    try {
      const response = await fetchApi("/chat/completions", {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        throw new Error(`Failed to list chats: ${response.statusText}`);
      }

      const data = (await response.json()) as {
        conversations: {
          id: string;
          title: string;
          messages: string[];
          last_message_at: string;
        }[];
      };

      if (!data.conversations || !Array.isArray(data.conversations)) {
        console.error(
          "Unexpected response format from /chat/completions endpoint:",
          data,
        );
        return [];
      }

      const results = data.conversations.map((conversation) => ({
        ...conversation,
        messages: [],
        message_ids: conversation.messages,
      }));

      return results.sort((a, b) => {
        const aTimestamp = new Date(a.last_message_at).getTime();
        const bTimestamp = new Date(b.last_message_at).getTime();
        return bTimestamp - aTimestamp;
      });
    } catch (error) {
      console.error("Error listing chats:", error);
      return [];
    }
  };

  getChat = async (completion_id: string): Promise<Conversation> => {
    let headers = {};
    try {
      headers = await this.getHeaders();
    } catch (error) {
      console.error("Error getting chat:", error);
    }

    const response = await fetchApi(`/chat/completions/${completion_id}`, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      throw new Error(`Failed to get chat: ${response.statusText}`);
    }

    const conversation = (await response.json()) as any;

    if (!conversation.id) {
      return {
        id: completion_id,
        title: "New conversation",
        messages: [],
      };
    }

    const messages = conversation.messages;

    const transformedMessages = messages.map((msg: any) =>
      normalizeMessage(msg),
    );

    return {
      id: completion_id,
      title: conversation.title,
      messages: transformedMessages,
      is_public: conversation.is_public,
      share_id: conversation.share_id,
    };
  };

  private formatMessageContent(messageContent: string): {
    content: string;
    reasoning: string;
  } {
    return formatMessageContent(messageContent);
  }

  generateTitle = async (
    completion_id: string,
    messages: Message[],
  ): Promise<string> => {
    let headers = {};
    try {
      headers = await this.getHeaders();
    } catch (error) {
      console.error("Error generating title:", error);
    }

    const formattedMessages = messages.map((msg) => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      data: msg.data,
      name: msg.name,
      tool_calls: msg.tool_calls,
    }));

    const response = await fetchApi(
      `/chat/completions/${completion_id}/generate-title`,
      {
        method: "POST",
        headers,
        body: {
          completion_id,
          messages: formattedMessages,
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to generate title: ${response.statusText}`);
    }

    const data = (await response.json()) as any;
    return data.title;
  };

  updateConversationTitle = async (
    completion_id: string,
    newTitle: string,
  ): Promise<void> => {
    let headers = {};
    try {
      headers = await this.getHeaders();
    } catch (error) {
      console.error("Error updating conversation title:", error);
    }

    const updateResponse = await fetchApi(
      `/chat/completions/${completion_id}`,
      {
        method: "PUT",
        headers,
        body: {
          completion_id,
          title: newTitle,
        },
      },
    );

    if (!updateResponse.ok) {
      throw new Error(
        `Failed to update chat title: ${updateResponse.statusText}`,
      );
    }
  };

  streamChatCompletions = async (
    completion_id: string,
    messages: Message[],
    model: string | undefined,
    mode: ChatMode,
    chatSettings: ChatSettings,
    signal: AbortSignal,
    onProgress: (
      text: string,
      reasoning?: string,
      toolResponses?: Message[],
    ) => void,
    store = true,
    streamingEnabled = true,
    useMultiModel = false,
  ): Promise<Message> => {
    let headers = {};
    try {
      headers = await this.getHeaders();
    } catch (error) {
      console.error("Error streaming chat completions:", error);
    }
    const { selectedTools } = useToolsStore.getState();

    const formattedMessages = messages.map((msg) => {
      if (Array.isArray(msg.content)) {
        return {
          id: msg.id || undefined,
          role: msg.role,
          content: msg.content,
          data: msg.data || undefined,
          name: msg.name || undefined,
        };
      }

      return {
        id: msg.id || undefined,
        role: msg.role,
        content:
          typeof msg.content === "string"
            ? msg.content
            : JSON.stringify(msg.content),
        data: msg.data || undefined,
        name: msg.name || undefined,
      };
    });

    const requestBody: Record<string, any> = {
      completion_id,
      mode,
      messages: formattedMessages,
      platform: "web",
      response_mode: chatSettings.response_mode || "normal",
      store,
      stream: streamingEnabled,
      enabled_tools: selectedTools,
      useMultiModel,
      ...chatSettings,
    };

    if (model !== undefined) {
      requestBody.model = model;
    }

    const response = await fetchApi("/chat/completions", {
      method: "POST",
      headers,
      body: requestBody,
      signal,
    });

    if (!response.ok) {
      throw new Error(
        `Failed to stream chat completions: ${response.statusText}`,
      );
    }

    const decoder = new TextDecoder();
    let buffer = "";

    let content = "";
    let messageData = null;
    let reasoning = "";
    let thinking = "";
    let citations = null;
    let usage = null;
    let id = null;
    let created = null;
    let logId = null;
    const toolCalls: any[] = [];
    const pendingToolCalls: Record<string, any> = {};
    const toolResponses: Message[] = [];

    let responseModel = model;

    const isStreamingResponse = response.headers
      .get("content-type")
      ?.includes("text/event-stream");

    if (!isStreamingResponse) {
      const data = (await response.json()) as any;

      if (data.error) {
        // Reset usage limits if there's an error response
        useUsageStore.getState().setUsageLimits(null);
        throw new Error(data.error.message || "Unknown error");
      }

      usage = data.usage || null;
      id = data.id || crypto.randomUUID();
      created = data.created || Date.now();
      logId = data.log_id || null;
      content = data.choices?.[0]?.message?.content || "";
      messageData = data.choices?.[0]?.message?.data || null;
      reasoning = data.choices?.[0]?.message?.reasoning || "";
      toolCalls.push(...(data.choices?.[0]?.message?.tool_calls || []));
      citations = data.choices?.[0]?.message?.citations || null;
    } else {
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Response body is not readable as a stream");
      }

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }

          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;

          const lines = buffer.split("\n\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.trim()) continue;

            if (line.startsWith("data: ")) {
              const data = line.substring(6);

              if (data === "[DONE]") {
                continue;
              }

              try {
                const parsedData = JSON.parse(data);

                if (parsedData.type === "content_block_delta") {
                  content += parsedData.content;
                  onProgress(content, reasoning);
                } else if (parsedData.type === "thinking_delta") {
                  thinking += parsedData.thinking || "";
                } else if (
                  parsedData.type === "usage_limits" &&
                  parsedData.usage_limits
                ) {
                  // Store usage limits in the usage store
                  useUsageStore
                    .getState()
                    .setUsageLimits(parsedData.usage_limits);
                } else if (parsedData.type === "tool_use_start") {
                  pendingToolCalls[parsedData.tool_id] = {
                    id: parsedData.tool_id,
                    name: parsedData.tool_name,
                    parameters: {},
                  };
                } else if (parsedData.type === "tool_use_delta") {
                  if (pendingToolCalls[parsedData.tool_id]) {
                    pendingToolCalls[parsedData.tool_id].parameters = {
                      ...pendingToolCalls[parsedData.tool_id].parameters,
                      ...parsedData.parameters,
                    };
                  }
                } else if (parsedData.type === "tool_use_stop") {
                  if (pendingToolCalls[parsedData.tool_id]) {
                    toolCalls.push(pendingToolCalls[parsedData.tool_id]);
                    delete pendingToolCalls[parsedData.tool_id];
                  }
                } else if (parsedData.type === "tool_response") {
                  if (toolResponses.find((tool) => tool.id === parsedData.id)) {
                    continue;
                  }

                  const toolResult = parsedData.result;
                  const toolResponseData = toolResult.data || null;

                  const toolResponse = normalizeMessage({
                    role: toolResult.role || "tool",
                    id: toolResult.id || crypto.randomUUID(),
                    content: toolResult.content || "",
                    name: toolResult.name,
                    status: toolResult.status || null,
                    data: toolResponseData,
                    created: Date.now(),
                    timestamp: toolResult.timestamp,
                    log_id: toolResult.log_id,
                    model: toolResult.model,
                    platform: toolResult.platform,
                    tool_calls: toolResult.tool_calls,
                  });

                  toolResponses.push(toolResponse);
                  onProgress("", "", [toolResponse]);
                } else if (parsedData.type === "message_delta") {
                  if (parsedData.usage) {
                    usage = parsedData.usage;
                  }
                  if (parsedData.log_id) {
                    logId = parsedData.log_id;
                  }
                  if (parsedData.citations) {
                    citations = parsedData.citations;
                  }
                  if (parsedData.model) {
                    responseModel = parsedData.model;
                  }
                }
              } catch (e) {
                console.error("Error parsing SSE data:", e, data);
              }
            }
          }
        }
      } catch (error) {
        console.error("Error reading stream:", error);
        if (error instanceof Error && error.name !== "AbortError") {
          // Reset usage limits if there's a stream reading error
          useUsageStore.getState().setUsageLimits(null);
          throw error;
        }
      } finally {
        reader.releaseLock();
      }
    }

    if (content) {
      const { content: formattedContent, reasoning: extractedReasoning } =
        this.formatMessageContent(content);
      content = formattedContent;
      reasoning = extractedReasoning;

      onProgress(content);
    }

    if (thinking) {
      reasoning = thinking;
    }

    return normalizeMessage({
      role: "assistant",
      content,
      data: messageData,
      reasoning: reasoning
        ? {
            collapsed: false,
            content: reasoning,
          }
        : undefined,
      id: id,
      created: created,
      model: responseModel,
      citations: citations || null,
      usage: usage,
      tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
      log_id: logId,
    });
  };

  deleteConversation = async (completion_id: string): Promise<void> => {
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
  };

  shareConversation = async (
    completion_id: string,
  ): Promise<{ share_id: string }> => {
    let headers = {};
    try {
      headers = await this.getHeaders();
    } catch (error) {
      console.error("Error sharing conversation:", error);
    }

    const response = await fetchApi(
      `/chat/completions/${completion_id}/share`,
      {
        method: "POST",
        headers,
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to share conversation: ${response.statusText}`);
    }

    return response.json();
  };

  unshareConversation = async (completion_id: string): Promise<void> => {
    let headers = {};
    try {
      headers = await this.getHeaders();
    } catch (error) {
      console.error("Error unsharing conversation:", error);
    }

    const response = await fetchApi(
      `/chat/completions/${completion_id}/share`,
      {
        method: "DELETE",
        headers,
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to unshare conversation: ${response.statusText}`);
    }
  };

  submitFeedback = async (
    completion_id: string,
    log_id: string,
    feedback: 1 | -1,
    score = 50,
  ): Promise<void> => {
    let headers = {};
    try {
      headers = await this.getHeaders();
    } catch (error) {
      console.error("Error submitting feedback:", error);
    }

    const response = await fetchApi(
      `/chat/completions/${completion_id}/feedback`,
      {
        method: "POST",
        headers,
        body: {
          log_id,
          feedback,
          score,
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to submit feedback: ${response.statusText}`);
    }
  };

  fetchModels = async (): Promise<ModelConfig> => {
    let headers = {};
    try {
      headers = await this.getHeaders();
    } catch (error) {
      console.error("Error fetching models:", error);
    }

    const response = await fetchApi("/models", {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.statusText}`);
    }
    const responseData = (await response.json()) as any;

    return responseData.data;
  };

  fetchTools = async (): Promise<any> => {
    let headers = {};
    try {
      headers = await this.getHeaders();
    } catch (error) {
      console.error("Error fetching tools:", error);
    }

    const response = await fetchApi("/tools", {
      method: "GET",
      headers,
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch tools: ${response.statusText}`);
    }
    const responseData = (await response.json()) as any;

    return responseData;
  };

  transcribeAudio = async (audioBlob: Blob): Promise<any> => {
    let headers = {};
    try {
      headers = await this.getHeaders();
    } catch (error) {
      console.error("Error transcribing audio:", error);
    }

    const formData = new FormData();
    formData.append("audio", audioBlob);

    const response = await fetchApi("/audio/transcribe", {
      method: "POST",
      headers,
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Failed to transcribe audio: ${response.statusText}`);
    }

    return await response.json();
  };

  uploadFile = async (
    file: File,
    fileType: "image" | "document",
    options?: { convertToMarkdown?: boolean },
  ): Promise<{
    url: string;
    type: string;
    name: string;
    markdown?: string;
  }> => {
    let headers = {};
    try {
      headers = await this.getHeaders();
    } catch (error) {
      console.error("Error uploading file:", error);
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("file_type", fileType);

    if (options?.convertToMarkdown) {
      formData.append("convert_to_markdown", "true");
    }

    const response = await fetchApi("/uploads", {
      method: "POST",
      headers,
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ error: response.statusText }));
      const errorMessage =
        typeof errorData === "object" &&
        errorData !== null &&
        "error" in errorData
          ? String(errorData.error)
          : response.statusText;
      throw new Error(`Failed to upload file: ${errorMessage}`);
    }

    return await response.json();
  };

  storeProviderApiKey = async (
    providerId: string,
    apiKey: string,
    secretKey?: string,
  ): Promise<void> => {
    let headers = {};
    try {
      headers = await this.getHeaders();
    } catch (error) {
      console.error("Error storing provider API key:", error);
    }

    const response = await fetchApi("/user/store-provider-api-key", {
      method: "POST",
      headers,
      body: {
        providerId,
        apiKey,
        secretKey,
      },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to store provider API key: ${response.statusText}`,
      );
    }
  };

  getProviderSettings = async (): Promise<{
    providers: Record<string, any>;
  }> => {
    let headers = {};
    try {
      headers = await this.getHeaders();
    } catch (error) {
      console.error("Error getting provider settings:", error);
    }

    const response = await fetchApi("/user/providers", {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      throw new Error(
        `Failed to get provider settings: ${response.statusText}`,
      );
    }

    return response.json();
  };

  syncProviders = async (): Promise<void> => {
    let headers = {};
    try {
      headers = await this.getHeaders();
    } catch (error) {
      console.error("Error syncing providers:", error);
    }

    const response = await fetchApi("/user/sync-providers", {
      method: "POST",
      headers,
    });

    if (!response.ok) {
      throw new Error(`Failed to sync providers: ${response.statusText}`);
    }
  };

  getUserApiKeys = async (): Promise<
    { id: string; name: string; created_at: string }[]
  > => {
    let headers = {};
    try {
      headers = await this.getHeaders();
    } catch (error) {
      console.error("Error getting API keys:", error);
    }

    const response = await fetchApi("/user/api-keys", {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      throw new Error(`Failed to get API keys: ${response.statusText}`);
    }
    return response.json();
  };

  createApiKey = async (
    name?: string,
  ): Promise<{
    apiKey: string;
    id: string;
    name: string;
    created_at: string;
  }> => {
    let headers = {};
    try {
      headers = await this.getHeaders();
    } catch (error) {
      console.error("Error creating API key:", error);
    }

    const response = await fetchApi("/user/api-keys", {
      method: "POST",
      headers,
      body: { name },
    });

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ error: response.statusText }));
      const errorMessage = (errorData as any)?.error || response.statusText;
      throw new Error(`Failed to create API key: ${errorMessage}`);
    }
    return response.json();
  };

  deleteApiKey = async (keyId: string): Promise<void> => {
    let headers = {};
    try {
      headers = await this.getHeaders();
    } catch (error) {
      console.error("Error deleting API key:", error);
    }

    const response = await fetchApi(`/user/api-keys/${keyId}`, {
      method: "DELETE",
      headers,
    });

    if (!response.ok) {
      throw new Error(`Failed to delete API key: ${response.statusText}`);
    }
  };

  public async getSubscription(): Promise<any | null> {
    const response = await fetchApi("/stripe/subscription");
    if (response.status === 404) return null;
    if (!response.ok) {
      const err = (await response.json()) as { error?: string };
      throw new Error(err.error || "Failed to fetch subscription");
    }
    return response.json();
  }

  public async createCheckoutSession(
    planId: string,
    successUrl: string,
    cancelUrl: string,
  ): Promise<{ url: string }> {
    const response = await fetchApi("/stripe/checkout", {
      method: "POST",
      body: { plan_id: planId, success_url: successUrl, cancel_url: cancelUrl },
    });
    const data = (await response.json()) as { url: string; error?: string };
    if (!response.ok) {
      throw new Error(data.error || "Checkout session creation failed");
    }
    return data;
  }

  public async cancelSubscription(): Promise<any> {
    const response = await fetchApi("/stripe/subscription/cancel", {
      method: "POST",
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      throw new Error(data.error || "Failed to cancel subscription");
    }
    return data;
  }

  async reactivateSubscription(): Promise<any> {
    const response = await fetchApi("/stripe/subscription/reactivate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const error = (await response.json()) as { message?: string };
      throw new Error(error.message || "Failed to reactivate subscription");
    }

    return response.json();
  }
}

export const apiService = ApiService.getInstance();
