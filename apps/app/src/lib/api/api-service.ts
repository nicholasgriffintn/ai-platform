import { apiKeyService } from "~/lib/api/api-key";
import { useChatStore } from "~/state/stores/chatStore";
import { useToolsStore } from "~/state/stores/toolsStore";
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

  public async getHeaders(): Promise<Record<string, string>> {
    const { turnstileToken } = useChatStore.getState();

    const headers: Record<string, string> = {
      "X-Turnstile-Token": turnstileToken || "na",
    };

    const apiKey = await apiKeyService.getApiKey();
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }

    return headers;
  }

  async listChats(): Promise<Conversation[]> {
    const headers = await this.getHeaders();

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
  }

  async getChat(completion_id: string): Promise<Conversation> {
    const headers = await this.getHeaders();

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
  }

  private formatMessageContent(messageContent: string): {
    content: string;
    reasoning: string;
  } {
    return formatMessageContent(messageContent);
  }

  async generateTitle(
    completion_id: string,
    messages: Message[],
  ): Promise<string> {
    const headers = await this.getHeaders();

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
  }

  async updateConversationTitle(
    completion_id: string,
    newTitle: string,
  ): Promise<void> {
    const headers = await this.getHeaders();

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
  }

  async streamChatCompletions(
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
  ): Promise<Message> {
    const headers = await this.getHeaders();
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
      response_mode: chatSettings.responseMode || "normal",
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
  }

  async deleteConversation(completion_id: string): Promise<void> {
    const headers = await this.getHeaders();

    const response = await fetchApi(`/chat/completions/${completion_id}`, {
      method: "DELETE",
      headers,
    });

    if (!response.ok) {
      throw new Error(`Failed to delete chat: ${response.statusText}`);
    }
  }

  async shareConversation(
    completion_id: string,
  ): Promise<{ share_id: string }> {
    const headers = await this.getHeaders();

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
  }

  async unshareConversation(completion_id: string): Promise<void> {
    const headers = await this.getHeaders();

    const response = await fetchApi(
      `/chat/completions/${completion_id}/unshare`,
      {
        method: "POST",
        headers,
      },
    );

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
    const headers = await this.getHeaders();

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
  }

  async fetchModels(): Promise<ModelConfig> {
    try {
      const response = await fetchApi("/models", {
        method: "GET",
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.statusText}`);
      }
      const responseData = (await response.json()) as any;

      return responseData.data;
    } catch (error) {
      console.error("Error fetching models:", error);
      return {};
    }
  }

  async fetchTools(): Promise<any> {
    try {
      const response = await fetchApi("/tools", {
        method: "GET",
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch tools: ${response.statusText}`);
      }
      const responseData = (await response.json()) as any;

      return responseData;
    } catch (error) {
      console.error("Error fetching tools:", error);
      return { success: false, message: "Failed to fetch tools", data: [] };
    }
  }

  async transcribeAudio(audioBlob: Blob): Promise<any> {
    const headers = await this.getHeaders();

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
  }

  async uploadFile(
    file: File,
    fileType: "image" | "document",
    options?: { convertToMarkdown?: boolean },
  ): Promise<{ url: string; type: string; name: string; markdown?: string }> {
    const headers = await this.getHeaders();

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
  }

  async storeProviderApiKey(
    providerId: string,
    apiKey: string,
    secretKey?: string,
  ): Promise<void> {
    const headers = await this.getHeaders();

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
  }

  async getProviderSettings(): Promise<{ providers: Record<string, any> }> {
    const headers = await this.getHeaders();

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
  }

  async syncProviders(): Promise<void> {
    const headers = await this.getHeaders();

    const response = await fetchApi("/user/sync-providers", {
      method: "POST",
      headers,
    });

    if (!response.ok) {
      throw new Error(`Failed to sync providers: ${response.statusText}`);
    }
  }

  async getUserApiKeys(): Promise<
    { id: string; name: string; created_at: string }[]
  > {
    const headers = await this.getHeaders();
    const response = await fetchApi("/user/api-keys", {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      throw new Error(`Failed to get API keys: ${response.statusText}`);
    }
    return response.json();
  }

  async createApiKey(
    name?: string,
  ): Promise<{ apiKey: string; id: string; name: string; created_at: string }> {
    const headers = await this.getHeaders();
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
  }

  async deleteApiKey(keyId: string): Promise<void> {
    const headers = await this.getHeaders();
    const response = await fetchApi(`/user/api-keys/${keyId}`, {
      method: "DELETE",
      headers,
    });

    if (!response.ok) {
      throw new Error(`Failed to delete API key: ${response.statusText}`);
    }
  }
}

export const apiService = ApiService.getInstance();
