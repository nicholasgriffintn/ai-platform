import { generateId } from "~/utils/id";

/**
 * Formats streaming responses
 * Handles specific streaming event types and partial content
 */
// biome-ignore lint/complexity/noStaticOnlyClass: Utility class with static methods
export class StreamingFormatter {
  /**
   * Extract text content from a streaming chunk of data
   * @param data - The data to extract content from
   * @param currentEventType - The current event type
   * @returns The extracted content
   */
  static extractContentFromChunk(data: any, currentEventType = "") {
    // OpenAI-like streaming streaming format
    if (data.choices?.[0]?.delta?.content !== undefined) {
      return data.choices[0].delta.content || "";
    }

    // Regular OpenAI-like message format
    if (data.choices?.[0]?.message?.content) {
      return data.choices[0].message.content;
    }

    // Google-style content format
    if (data.candidates?.[0]?.content?.parts) {
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

      return textResponse;
    }

    // Anthropic like text_delta format
    if (data.delta?.type === "text_delta" && data.delta.text) {
      return data.delta.text;
    }

    // Anthropic like text_delta format in content_block_delta
    if (
      currentEventType === "content_block_delta" &&
      data.delta?.type === "text_delta"
    ) {
      return data.delta.text || "";
    }

    // Array of content blocks Anthropic-like streaming
    if (Array.isArray(data.message?.content)) {
      return data.message.content
        .filter((block: any) => block.type === "text" && block.text)
        .map((block: any) => block.text)
        .join("");
    }

    // Direct content provided
    if (typeof data.content === "string") {
      return data.content;
    }
    if (data.response !== undefined) {
      return data.response;
    }

    // Ollama-like format
    if (data.message?.content) {
      return data.message.content;
    }

    // Direct text field provided
    if (data.text) {
      return data.text;
    }

    // empty string for unrecognized formats
    return "";
  }

  /**
   * Extract thinking content from a streaming chunk of data
   * @param data - The data to extract thinking from
   * @param currentEventType - The current event type
   * @returns The extracted thinking
   */
  static extractThinkingFromChunk(data: any, currentEventType = "") {
    if (
      currentEventType === "content_block_delta" &&
      data.delta?.type === "thinking_delta" &&
      data.delta.thinking
    ) {
      return data.delta.thinking || "";
    }

    if (
      currentEventType === "content_block_delta" &&
      data.delta?.type === "signature_delta" &&
      data.delta.signature
    ) {
      return {
        type: "signature",
        signature: data.delta.signature,
      };
    }

    return null;
  }

  /**
   * Detect if a chunk contains a tool call initialization or update
   * @param data - The data to extract tool call from
   * @param currentEventType - The current event type
   * @returns The extracted tool call
   */
  static extractToolCall(data: any, currentEventType = "") {
    // OpenAI-like tool calls
    if (data.choices?.[0]?.delta?.tool_calls) {
      return {
        format: "openai",
        toolCalls: data.choices[0].delta.tool_calls,
      };
    }

    // Google-style functionCall format
    if (data.candidates?.[0]?.content?.parts) {
      const parts = data.candidates[0].content.parts;
      const toolCalls = parts
        .filter((part: any) => part.functionCall)
        .map((part: any) => ({
          id: `call_${generateId()}`,
          type: "function",
          function: {
            name: part.functionCall.name,
            arguments: JSON.stringify(part.functionCall.args || {}),
          },
        }));

      if (toolCalls.length > 0) {
        return {
          format: "direct",
          toolCalls: toolCalls,
        };
      }
    }

    // Anthropic-like tool_use blocks
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

    // Anthropic-like tool input updates
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
   * @param data - The data to check for completion
   * @returns Whether the chunk indicates completion
   */
  static isCompletionIndicated(data: any): boolean {
    // OpenAI format
    const openaiFinishReason =
      data.choices?.[0]?.finish_reason?.toLowerCase() ||
      data.choices?.[0]?.finishReason?.toLowerCase();

    if (openaiFinishReason === "stop" || openaiFinishReason === "length") {
      return true;
    }

    // Google format
    const googleFinishReason =
      data.candidates?.[0]?.finishReason?.toLowerCase();
    if (googleFinishReason === "stop" || googleFinishReason === "length") {
      return true;
    }

    return false;
  }

  /**
   * Extract usage information from a response
   * @param data - The data to extract usage from
   * @returns The extracted usage
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
   * @param data - The data to extract citations from
   * @returns The extracted citations
   */
  static extractCitations(data: any): any[] {
    if (Array.isArray(data.citations)) {
      return data.citations;
    }

    // Google's search grounding format
    if (data.candidates?.[0]?.groundingMetadata) {
      const searchGrounding = data.candidates[0].groundingMetadata;
      return [
        {
          searchGrounding: {
            ...searchGrounding,
            searchEntryPoint: {
              ...searchGrounding.searchEntryPoint,
              renderedContent: undefined,
            },
            groundingSupports: {},
          },
        },
      ];
    }

    return [];
  }

  /**
   * Extract structured data from a response (for Google search grounding, etc.)
   * @param data - The data to extract structured data from
   * @returns The extracted data
   */
  static extractStructuredData(data: any): any {
    // Google's search grounding format
    if (data.candidates?.[0]?.groundingMetadata) {
      const searchGrounding = data.candidates[0].groundingMetadata;
      return {
        searchGrounding: {
          ...searchGrounding,
          searchEntryPoint: {
            ...searchGrounding.searchEntryPoint,
            renderedContent: undefined,
          },
          groundingSupports: {},
        },
      };
    }

    return null;
  }

  // Claude web search helpers
  static isWebSearchToolResult(data: any, currentEventType: string): boolean {
    return currentEventType === "web_search_tool_result" && !!data;
  }

  static extractWebSearchResult(data: any, currentEventType: string): any | null {
    if (!this.isWebSearchToolResult(data, currentEventType)) {
      return null;
    }

    const encryptedContent = data.encrypted_content;
    const title = data.title || data.metadata?.title || "";
    const url = data.url || data.metadata?.url || "";
    const page_age = data.page_age || data.metadata?.page_age || null;

    return {
      title,
      url,
      page_age,
      content: encryptedContent ? "" : data.content || "",
      encrypted_content: encryptedContent ? true : false,
    };
  }
}
