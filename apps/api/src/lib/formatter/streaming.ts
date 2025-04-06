/**
 * Formats streaming responses
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

    // OpenAI-like streaming streaming format
    if (data.choices?.[0]?.delta?.content !== undefined) {
      return data.choices[0].delta.content || "";
    }

    // Regular OpenAI-like message format
    if (data.choices?.[0]?.message?.content) {
      return data.choices[0].message.content;
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

    // Direct content provided
    if (typeof data.content === "string") {
      return data.content;
    }

    // Array of content blocks Anthropic-like streaming
    if (Array.isArray(data.message?.content)) {
      return data.message.content
        .filter((block: any) => block.type === "text" && block.text)
        .map((block: any) => block.text)
        .join("");
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
   */
  static extractThinkingFromChunk(data: any, currentEventType = "") {
    // Check for Anthropic thinking_delta format
    if (
      currentEventType === "content_block_delta" &&
      data.delta?.type === "thinking_delta" &&
      data.delta.thinking
    ) {
      return data.delta.thinking || "";
    }

    // Check for Anthropic signature_delta format
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
   */
  static extractToolCall(data: any, currentEventType = "") {
    // OpenAI-like tool calls
    if (data.choices?.[0]?.delta?.tool_calls) {
      return {
        format: "openai",
        toolCalls: data.choices[0].delta.tool_calls,
      };
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
