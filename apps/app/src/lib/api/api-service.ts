import { apiKeyService } from "~/lib/api/api-key";
import { useCaptchaStore } from "~/state/stores/captchaStore";
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
      const headers: Record<string, string> = {};

      const apiKey = await apiKeyService.getApiKey();
      if (apiKey) {
        headers.Authorization = `Bearer ${apiKey}`;
      }

      const captchaToken = useCaptchaStore.getState().captchaToken;
      if (captchaToken) {
        headers["X-Captcha-Token"] = captchaToken;
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
          parent_conversation_id?: string;
          parent_message_id?: string;
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
        parent_conversation_id: conversation.parent_conversation_id,
        parent_message_id: conversation.parent_message_id,
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
    if (!completion_id) {
      throw new Error("No completion ID provided");
    }

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
      parent_conversation_id: conversation.parent_conversation_id,
      parent_message_id: conversation.parent_message_id,
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
    if (!completion_id) {
      throw new Error("No completion ID provided");
    }

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
    if (!completion_id) {
      throw new Error("No completion ID provided");
    }

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
      done?: boolean,
    ) => void,
    onStateChange: (state: string, data?: any) => void,
    store = true,
    streamingEnabled = true,
    use_multi_model = false,
    endpoint = "/chat/completions",
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
      ...chatSettings,
      completion_id,
      mode,
      messages: formattedMessages,
      platform: "web",
      response_mode: chatSettings.response_mode || "normal",
      store,
      stream: streamingEnabled,
      enabled_tools: selectedTools,
      use_multi_model,
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
                onProgress(content, reasoning, undefined, true);
                continue;
              }

              try {
                const parsedData = JSON.parse(data);

                if (parsedData.type === "content_block_delta") {
                  content += parsedData.content;
                  onProgress(content, reasoning, undefined, false);
                } else if (parsedData.choices?.[0]?.delta?.content) {
                  content += parsedData.choices[0].delta.content;
                  onProgress(content, reasoning, undefined, false);
                } else if (parsedData.type === "message_stop") {
                  onProgress(content, reasoning, undefined, true);
                } else if (parsedData.type === "state") {
                  onStateChange(parsedData.state, parsedData);
                } else if (parsedData.type === "thinking_delta") {
                  thinking += parsedData.thinking || "";
                  onProgress(content, thinking, undefined, false);
                } else if (
                  parsedData.type === "usage_limits" &&
                  parsedData.usage_limits
                ) {
                  useUsageStore
                    .getState()
                    .setUsageLimits(parsedData.usage_limits);
                } else if (parsedData.type === "tool_use_start") {
                  pendingToolCalls[parsedData.tool_id] = {
                    id: parsedData.tool_id,
                    name: parsedData.tool_name,
                    parameters: {},
                  };
                  onStateChange("tool_use_start", parsedData);
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
                  onStateChange("tool_use_stop", parsedData);
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
                } else if (parsedData.type === "server_tool_use") {
                  // Dev logging for Claude server tool usage start
                  // eslint-disable-next-line no-console
                  console.debug?.("server_tool_use", parsedData);
                } else if (parsedData.type === "web_search_tool_result") {
                  // Dev logging for Claude web search result chunks
                  // eslint-disable-next-line no-console
                  console.debug?.("web_search_tool_result", parsedData);
                } else if (parsedData.type === "web_search_tool_result_end") {
                  // Dev logging for Claude web search result end
                  // eslint-disable-next-line no-console
                  console.debug?.("web_search_tool_result_end", parsedData);
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

      onProgress(content, reasoning);
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
  };

  deleteAllConversations = async (): Promise<void> => {
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
      throw new Error(
        `Failed to delete all conversations: ${response.statusText}`,
      );
    }
  };

  shareConversation = async (
    completion_id: string,
  ): Promise<{ share_id: string }> => {
    if (!completion_id) {
      throw new Error("No completion ID provided");
    }

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
    if (!completion_id) {
      throw new Error("No completion ID provided");
    }

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
    if (!completion_id) {
      throw new Error("No completion ID provided");
    }

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
    fileType: "image" | "document" | "audio",
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

  public listAgents = async (): Promise<any[]> => {
    let headers: Record<string, string> = {};

    try {
      headers = await this.getHeaders();
    } catch (error) {
      console.error("Error getting headers for listAgents:", error);
    }

    const response = await fetchApi("/agents", { method: "GET", headers });

    if (!response.ok) {
      throw new Error(`Failed to list agents: ${response.statusText}`);
    }

    const responseData = (await response.json()) as { data: any[] };

    return responseData.data || [];
  };

  public listSharedAgents = async ({
    category,
    tags,
    search,
    featured,
    limit,
    offset,
    sort_by,
  }: {
    category?: string;
    tags?: string[];
    search?: string;
    featured?: boolean;
    limit?: number;
    offset?: number;
    sort_by?: string;
  } = {}): Promise<any[]> => {
    const params = new URLSearchParams();

    if (category) {
      params.append("category", category);
    }

    if (tags?.length) {
      tags.forEach((tag) => params.append("tags", tag));
    }

    if (search) {
      params.append("search", search);
    }

    if (featured !== undefined) {
      params.append("featured", String(featured));
    }

    if (limit !== undefined) {
      params.append("limit", String(limit));
    }

    if (offset !== undefined) {
      params.append("offset", String(offset));
    }

    if (sort_by) {
      params.append("sort_by", sort_by);
    }

    const response = await fetchApi(`/agents/shared?${params.toString()}`, {
      method: "GET",
    });

    if (!response.ok) {
      throw new Error(`Failed to list shared agents: ${response.statusText}`);
    }

    const responseData = (await response.json()) as { data: any[] };

    return responseData.data || [];
  };

  public listFeaturedSharedAgents = async (limit = 10): Promise<any[]> => {
    const params = new URLSearchParams();
    params.append("limit", String(limit));
    const response = await fetchApi(
      `/agents/shared/featured?${params.toString()}`,
      { method: "GET" },
    );

    if (!response.ok) {
      throw new Error(`Failed to list featured agents: ${response.statusText}`);
    }

    const responseData = (await response.json()) as { data: any[] };

    return responseData.data || [];
  };

  public installSharedAgent = async (agentId: string): Promise<any> => {
    const response = await fetchApi(`/agents/shared/${agentId}/install`, {
      method: "POST",
    });

    if (!response.ok) {
      throw new Error(`Failed to install shared agent: ${response.statusText}`);
    }

    const responseData = (await response.json()) as { data: any[] };

    return responseData.data || [];
  };

  public shareAgent = async (
    agentId: string,
    name: string,
    description?: string | null,
    avatarUrl?: string | null,
    category?: string | null,
    tags?: string[] | null,
  ): Promise<any> => {
    const body = {
      agent_id: agentId,
      name,
      description,
      avatar_url: avatarUrl,
      category,
      tags,
    };
    const response = await fetchApi(`/agents/shared/share`, {
      method: "POST",
      body,
    });

    if (!response.ok) {
      throw new Error(`Failed to share agent: ${response.statusText}`);
    }

    const responseData = (await response.json()) as { data: any[] };

    return responseData.data || [];
  };

  public rateSharedAgent = async (
    agentId: string,
    rating: number,
    review?: string,
  ): Promise<any> => {
    const body = { rating, review };
    const response = await fetchApi(`/agents/shared/${agentId}/rate`, {
      method: "POST",
      body,
    });

    if (!response.ok) {
      throw new Error(`Failed to rate shared agent: ${response.statusText}`);
    }

    const responseData = (await response.json()) as { data: any[] };

    return responseData.data || [];
  };

  public getAgentRatings = async (
    agentId: string,
    limit = 10,
  ): Promise<any[]> => {
    const params = new URLSearchParams();
    params.append("limit", String(limit));
    const response = await fetchApi(
      `/agents/shared/${agentId}/ratings?${params.toString()}`,
      { method: "GET" },
    );

    if (!response.ok) {
      throw new Error(`Failed to get agent ratings: ${response.statusText}`);
    }

    const responseData = (await response.json()) as { data: any[] };

    return responseData.data || [];
  };

  public getSharedCategories = async (): Promise<string[]> => {
    const response = await fetchApi(`/agents/shared/categories`, {
      method: "GET",
    });

    if (!response.ok) {
      throw new Error(
        `Failed to get shared agent categories: ${response.statusText}`,
      );
    }

    const responseData = (await response.json()) as { data: any[] };

    return responseData.data || [];
  };

  public getSharedTags = async (): Promise<string[]> => {
    const response = await fetchApi(`/agents/shared/tags`, { method: "GET" });

    if (!response.ok) {
      throw new Error(
        `Failed to get shared agent tags: ${response.statusText}`,
      );
    }

    const responseData = (await response.json()) as { data: any[] };

    return responseData.data || [];
  };

  public createAgent = async (
    name: string,
    servers?: any[],
    description?: string | null,
    avatarUrl?: string | null,
    model?: string | null,
    temperature?: number | null,
    maxSteps?: number | null,
    systemPrompt?: string | null,
    fewShotExamples?: any[] | null,
    teamId?: string | null,
    teamRole?: string | null,
    isTeamAgent?: boolean | null,
  ): Promise<any> => {
    let headers: Record<string, string> = {};

    try {
      headers = await this.getHeaders();
    } catch (error) {
      console.error("Error getting headers for createAgent:", error);
    }

    const body = {
      name,
      description: description || undefined,
      avatar_url: avatarUrl || undefined,
      servers: servers || undefined,
      model: model || undefined,
      temperature: temperature !== undefined ? temperature : undefined,
      max_steps: maxSteps !== undefined ? maxSteps : undefined,
      system_prompt: systemPrompt || undefined,
      few_shot_examples: fewShotExamples || undefined,
      team_id: teamId || undefined,
      team_role: teamRole || undefined,
      is_team_agent: isTeamAgent ? isTeamAgent : undefined,
    };

    const response = await fetchApi("/agents", {
      method: "POST",
      headers,
      body,
    });

    if (!response.ok) {
      throw new Error(`Failed to create agent: ${response.statusText}`);
    }

    const responseData = (await response.json()) as { data: any };
    return responseData.data;
  };

  public updateAgent = async (
    agentId: string,
    data: Partial<{
      name: string;
      description: string;
      avatar_url: string;
      servers: any[];
      model: string;
      temperature: number;
      max_steps: number;
      system_prompt: string;
      few_shot_examples: Array<{ input: string; output: string }>;
    }>,
  ): Promise<void> => {
    let headers: Record<string, string> = {};

    try {
      headers = await this.getHeaders();
    } catch (error) {
      console.error("Error getting headers for updateAgent:", error);
    }

    const body = {
      name: data.name || undefined,
      description: data.description || undefined,
      avatar_url: data.avatar_url || undefined,
      servers: data.servers || undefined,
      model: data.model || undefined,
      temperature:
        data.temperature !== undefined ? data.temperature : undefined,
      max_steps: data.max_steps !== undefined ? data.max_steps : undefined,
      system_prompt: data.system_prompt || undefined,
      few_shot_examples: data.few_shot_examples || undefined,
    };

    const response = await fetchApi(`/agents/${agentId}`, {
      method: "PUT",
      headers,
      body,
    });

    if (!response.ok) {
      throw new Error(`Failed to update agent: ${response.statusText}`);
    }

    const responseData = (await response.json()) as { data: any };
    return responseData.data;
  };

  public deleteAgent = async (agentId: string): Promise<void> => {
    let headers: Record<string, string> = {};

    try {
      headers = await this.getHeaders();
    } catch (error) {
      console.error("Error getting headers for deleteAgent:", error);
    }

    const response = await fetchApi(`/agents/${agentId}`, {
      method: "DELETE",
      headers,
    });

    if (!response.ok) {
      throw new Error(`Failed to delete agent: ${response.statusText}`);
    }

    const responseData = (await response.json()) as { data: any };
    return responseData.data;
  };
}

export const apiService = ApiService.getInstance();
