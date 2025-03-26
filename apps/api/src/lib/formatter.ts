import type { ChatRole, Message, MessageContent } from "../types";

interface MessageFormatOptions {
  maxTokens?: number;
  truncationStrategy?: "head" | "tail" | "middle";
  provider?: string;
  model?: string;
  system_prompt?: string;
}

// biome-ignore lint/complexity/noStaticOnlyClass: Static utility class
export class MessageFormatter {
  static formatMessages(
    messages: Message[],
    options: MessageFormatOptions = {},
  ): Message[] {
    const {
      maxTokens = 0,
      truncationStrategy = "tail",
      provider = "default",
      model,
      system_prompt,
    } = options;

    let formattedMessages = messages.filter((msg) => msg.content);

    if (
      maxTokens > 0 &&
      MessageFormatter.countTokens(formattedMessages) > maxTokens
    ) {
      formattedMessages = MessageFormatter.truncateMessages(
        formattedMessages,
        maxTokens,
        truncationStrategy,
      );
    }

    formattedMessages = MessageFormatter.formatMessageContent(
      formattedMessages,
      provider,
    );

    if (system_prompt) {
      formattedMessages = MessageFormatter.addsystem_prompt(
        formattedMessages,
        system_prompt,
        provider,
        model,
      );
    }

    return formattedMessages;
  }

  private static formatMessageContent(
    messages: Message[],
    provider: string,
  ): Message[] {
    return messages.map((message) => {
      const content = MessageFormatter.formatContent(message.content, provider);

      if (message.role === "tool") {
        let stringifiedData;
        if (message.data) {
          try {
            stringifiedData = JSON.stringify(message.data);
          } catch (error) {
            stringifiedData = "";
          }
        }

        return {
          role: "assistant",
          content: `[Tool Response: ${message.name || "unknown"}] ${typeof content === "string" ? content : JSON.stringify(content)} ${stringifiedData ? `\n\nData: ${stringifiedData}` : ""}`,
        };
      }

      switch (provider) {
        case "google-ai-studio":
          return {
            role: message.role,
            parts: Array.isArray(content) ? content : [{ text: content }],
            content: "",
          };
        default:
          if (
            Array.isArray(content) &&
            content.length === 1 &&
            typeof content[0] === "string"
          ) {
            return {
              role: message.role,
              content: content[0],
            };
          }

          return {
            role: message.role,
            content,
          };
      }
    });
  }

  private static formatContent(
    content: Message["content"],
    provider: string,
  ): any {
    if (!Array.isArray(content)) {
      return content;
    }

    switch (provider) {
      case "google-ai-studio":
        return content.map((item) =>
          MessageFormatter.formatGoogleAIContent(item),
        );
      case "anthropic":
        return content.map((item) =>
          MessageFormatter.formatAnthropicContent(item),
        );
      case "bedrock":
        return content.map((item) =>
          MessageFormatter.formatBedrockContent(item),
        );
      case "workers-ai":
      case "ollama":
      case "github-models": {
        const imageItem = content.find(
          (item) =>
            typeof item === "object" &&
            "type" in item &&
            item.type === "image_url",
        );

        if (
          imageItem &&
          typeof imageItem === "object" &&
          "image_url" in imageItem &&
          imageItem.image_url &&
          typeof imageItem.image_url === "object" &&
          "url" in imageItem.image_url
        ) {
          return {
            text: content
              .filter(
                (item) =>
                  typeof item === "object" &&
                  "type" in item &&
                  item.type === "text",
              )
              .map((item) =>
                typeof item === "object" && "text" in item ? item.text : "",
              )
              .join("\n"),
            image: MessageFormatter.getBase64FromUrl(imageItem.image_url.url),
          };
        }

        return content
          .filter(
            (item) =>
              typeof item === "object" &&
              "type" in item &&
              item.type === "text",
          )
          .map((item) =>
            typeof item === "object" && "text" in item ? item.text : "",
          )
          .join("\n");
      }
      default:
        return content;
    }
  }

  private static addsystem_prompt(
    messages: Message[],
    system_prompt: string,
    provider: string,
    model?: string,
  ): Message[] {
    if (!system_prompt) {
      return messages;
    }

    switch (provider) {
      case "anthropic":
      case "bedrock":
      case "google-ai-studio":
        return messages;
      case "openai":
        return [
          { role: "developer" as ChatRole, content: system_prompt },
          ...messages,
        ];
      case "workers-ai":
      case "groq":
      case "ollama":
      case "github-models":
        return [
          {
            role: "system",
            content: system_prompt,
          },
          ...messages,
        ] as Message[];
      default:
        return [
          {
            role: "system" as ChatRole,
            content: [{ type: "text", text: system_prompt }],
          },
          ...messages,
        ];
    }
  }

  private static countTokens(messages: Message[]): number {
    return messages.reduce(
      (total, msg) =>
        total +
        (typeof msg.content === "string"
          ? msg.content.length
          : JSON.stringify(msg.content).length),
      0,
    );
  }

  private static truncateMessages(
    messages: Message[],
    maxTokens: number,
    strategy: "head" | "tail" | "middle",
  ): Message[] {
    switch (strategy) {
      case "tail":
        return messages.slice(-Math.floor(messages.length / 2));
      case "head":
        return messages.slice(0, Math.floor(messages.length / 2));
      case "middle": {
        const midPoint = Math.floor(messages.length / 2);
        return messages.slice(
          midPoint - Math.floor(maxTokens / 2),
          midPoint + Math.floor(maxTokens / 2),
        );
      }
    }
  }

  private static formatGoogleAIContent(item: MessageContent): any {
    if (item.type === "text") {
      return { text: item.text };
    }
    if (item.type === "image_url" && item.image_url?.url) {
      return {
        inlineData: {
          mimeType: MessageFormatter.resolveType(item.image_url.url),
          data: MessageFormatter.getBase64FromUrl(item.image_url.url),
        },
      };
    }
    return item;
  }

  private static formatAnthropicContent(item: MessageContent): any {
    if (item.type === "text") {
      return { type: "text", text: item.text };
    }
    if (item.type === "image_url" && item.image_url?.url) {
      return {
        type: "image",
        source: {
          type: "url",
          url: item.image_url.url,
        },
        cache_control: {
          type: "ephemeral",
        },
      };
    }
    if (item.type === "document_url" && item.document_url?.url) {
      return {
        type: "document",
        source: {
          type: "url",
          url: item.document_url.url,
        },
        cache_control: {
          type: "ephemeral",
        },
      };
    }

    return item;
  }

  private static formatBedrockContent(item: MessageContent): any {
    if (item.type === "text") {
      return { text: item.text };
    }
    if (typeof item === "string") {
      return { text: item };
    }
    return item;
  }

  private static resolveType(dataUrl: string): string {
    const match = dataUrl.match(/^data:([^;]+);base64,/);
    return match ? match[1] : "application/octet-stream";
  }

  private static getBase64FromUrl(dataUrl: string): string {
    const base64Match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    return base64Match ? base64Match[2] : dataUrl;
  }
}

interface ResponseFormatOptions {
  model?: string;
  type?: string[];
}

/**
 * Utilities for formatting streaming responses
 * Handles specific streaming event types and partial content
 */
// biome-ignore lint/complexity/noStaticOnlyClass: Utility class with static methods
export class StreamingFormatter {
  /**
   * Extract text content from a streaming chunk of data
   */
  static extractContentFromChunk(data: any, currentEventType = "") {
    // First check if the data was already formatted
    if (data.response !== undefined) {
      return data.response;
    }

    // OpenAI streaming format
    if (data.choices?.[0]?.delta?.content !== undefined) {
      return data.choices[0].delta.content || "";
    }

    // Regular OpenAI message format
    if (data.choices?.[0]?.message?.content) {
      return data.choices[0].message.content;
    }

    // Anthropic's text_delta format
    if (data.delta?.type === "text_delta" && data.delta.text) {
      return data.delta.text;
    }

    // Claude specific format in content_block_delta
    if (
      currentEventType === "content_block_delta" &&
      data.delta?.type === "text_delta"
    ) {
      return data.delta.text || "";
    }

    // Direct content field
    if (typeof data.content === "string") {
      return data.content;
    }

    // Array of content blocks (Anthropic/Claude)
    if (Array.isArray(data.message?.content)) {
      return data.message.content
        .filter((block: any) => block.type === "text" && block.text)
        .map((block: any) => block.text)
        .join("");
    }

    // Ollama format
    if (data.message?.content) {
      return data.message.content;
    }

    // Direct text field
    if (data.text) {
      return data.text;
    }

    // Last resort - empty string for unrecognized formats
    return "";
  }

  /**
   * Detect if a chunk contains a tool call initialization or update
   */
  static extractToolCall(data: any, currentEventType = "") {
    // OpenAI tool calls
    if (data.choices?.[0]?.delta?.tool_calls) {
      return {
        format: "openai",
        toolCalls: data.choices[0].delta.tool_calls,
      };
    }

    // Anthropic tool_use blocks
    if (
      currentEventType === "content_block_start" &&
      data.content_block?.type === "tool_use"
    ) {
      return {
        format: "anthropic",
        id: data.content_block.id,
        name: data.content_block.name,
        index: data.index,
      };
    }

    // Anthropic tool input updates
    if (
      currentEventType === "content_block_delta" &&
      data.delta?.type === "input_json_delta" &&
      data.index !== undefined
    ) {
      return {
        format: "anthropic_delta",
        index: data.index,
        partial_json: data.delta.partial_json || "",
      };
    }

    // Other direct tool_calls formats
    if (data.tool_calls) {
      return {
        format: "direct",
        toolCalls: data.tool_calls,
      };
    }

    return null;
  }

  /**
   * Checks if a streaming chunk indicates completion
   */
  static isCompletionIndicated(data: any): boolean {
    const finishReason =
      data.choices?.[0]?.finish_reason?.toLowerCase() ||
      data.choices?.[0]?.finishReason?.toLowerCase();

    if (finishReason === "stop" || finishReason === "length") {
      return true;
    }

    return false;
  }

  /**
   * Extract usage information from a response
   */
  static extractUsageData(data: any): any {
    if (data.usage) {
      return data.usage;
    }

    if (data.usageMetadata) {
      return data.usageMetadata;
    }

    return null;
  }

  /**
   * Extract citations from a response
   */
  static extractCitations(data: any): any[] {
    if (Array.isArray(data.citations)) {
      return data.citations;
    }

    return [];
  }
}

// biome-ignore lint/complexity/noStaticOnlyClass: CBA
export class ResponseFormatter {
  /**
   * Format a response from any provider
   */
  static formatResponse(
    data: any,
    provider: string,
    options: ResponseFormatOptions = {},
  ): any {
    const formatter = ResponseFormatter.getFormatter(provider);
    return formatter(data, options);
  }

  /**
   * Get the appropriate formatter function for a provider
   */
  private static getFormatter(
    provider: string,
  ): (data: any, options: ResponseFormatOptions) => any {
    const formatters: Record<
      string,
      (data: any, options: ResponseFormatOptions) => any
    > = {
      openai: ResponseFormatter.formatOpenAIResponse,
      anthropic: ResponseFormatter.formatAnthropicResponse,
      "google-ai-studio": ResponseFormatter.formatGoogleStudioResponse,
      ollama: ResponseFormatter.formatOllamaResponse,
      bedrock: ResponseFormatter.formatBedrockResponse,
      workers: ResponseFormatter.formatWorkersResponse,
      openrouter: ResponseFormatter.formatOpenRouterResponse,
      groq: ResponseFormatter.formatOpenAIResponse, // Uses OpenAI format
      mistral: ResponseFormatter.formatOpenAIResponse, // Uses OpenAI format
      "perplexity-ai": ResponseFormatter.formatOpenAIResponse, // Uses OpenAI format
      deepseek: ResponseFormatter.formatOpenAIResponse, // Uses OpenAI format
      huggingface: ResponseFormatter.formatOpenAIResponse, // Uses OpenAI format
      "github-models": ResponseFormatter.formatOpenAIResponse, // Uses OpenAI format
      "together-ai": ResponseFormatter.formatOpenAIResponse, // Uses OpenAI format
    };

    return formatters[provider] || ResponseFormatter.formatGenericResponse;
  }

  /**
   * Format generic/unknown provider responses
   * Attempts to extract content from common response formats
   */
  private static formatGenericResponse(data: any): any {
    // Handle the most common response shapes
    if (data.response !== undefined) {
      return data; // Already has response field
    }

    if (data.choices?.[0]) {
      if (data.choices[0].message?.content) {
        return { ...data, response: data.choices[0].message.content };
      }
      if (data.choices[0].delta?.content !== undefined) {
        return { ...data, response: data.choices[0].delta.content || "" };
      }
      if (data.choices[0].text) {
        return { ...data, response: data.choices[0].text };
      }
    }

    if (data.delta?.text) {
      return { ...data, response: data.delta.text };
    }

    if (data.content && typeof data.content === "string") {
      return { ...data, response: data.content };
    }

    if (data.content && Array.isArray(data.content)) {
      const textContent = data.content
        .filter((item: any) => item.text)
        .map((item: any) => item.text)
        .join(" ");

      return { ...data, response: textContent || "" };
    }

    if (data.message?.content) {
      if (typeof data.message.content === "string") {
        return { ...data, response: data.message.content };
      }
      if (Array.isArray(data.message.content)) {
        const textContent = data.message.content
          .filter((item: any) => item.type === "text" && item.text)
          .map((item: any) => item.text)
          .join(" ");

        return { ...data, response: textContent || "" };
      }
    }

    // Last resort fallback
    return { ...data, response: "" };
  }

  private static formatOpenAIResponse(data: any): any {
    const message = data.choices?.[0]?.message;
    return { ...data, response: message?.content || "", ...message };
  }

  private static formatOpenRouterResponse(data: any): any {
    const message = data.choices?.[0]?.message;
    const content = message?.content || "";

    return {
      ...data,
      response: content,
    };
  }

  private static formatAnthropicResponse(data: any): any {
    if (!data.content) {
      return { ...data, response: "" };
    }

    const response = data.content
      .map((content: { text: string }) => content.text)
      .join(" ");

    return { ...data, response };
  }

  private static formatGoogleStudioResponse(data: any): any {
    if (!data.candidates || !data.candidates[0]?.content?.parts) {
      return { ...data, response: "" };
    }

    const parts = data.candidates[0].content.parts;

    let textResponse = "";

    parts.forEach((part: any, index: number) => {
      if (part.text) {
        textResponse += (textResponse ? "\n" : "") + part.text;
      } else if (part.executableCode) {
        const code = part.executableCode;
        const language = code.language?.toLowerCase() || "code";
        textResponse += `\n\n<artifact identifier="executable-code-${index}" type="application/code" language="${language}" title="Executable ${language} Code">${code.code}</artifact>`;
      } else if (part.codeExecutionResult) {
        const result = part.codeExecutionResult;
        if (result.output) {
          textResponse += `\n\n${result.output}\n\n`;
        }
      }
    });

    return { ...data, response: textResponse };
  }

  private static formatOllamaResponse(data: any): any {
    return { ...data, response: data.message?.content || "" };
  }

  private static formatWorkersResponse(data: any): any {
    if (data.response) {
      return data;
    }

    return { ...data, response: data.result || "" };
  }

  private static formatBedrockResponse(
    data: any,
    options: ResponseFormatOptions = {},
  ): any {
    const type = options.type || ["text"];
    const isImageType =
      type.includes("text-to-image") || type.includes("image-to-image");
    const isVideoType =
      type.includes("text-to-video") || type.includes("image-to-video");

    if (isVideoType) {
      return { ...data, response: data };
    }

    if (isImageType && data.images) {
      return {
        ...data,
        response: `Image Generated: [${Math.random().toString(36)}]`,
      };
    }

    if (data.output?.message?.content?.[0]?.text) {
      return { ...data, response: data.output.message.content[0].text };
    }

    return { ...data, response: "No content returned" };
  }
}
