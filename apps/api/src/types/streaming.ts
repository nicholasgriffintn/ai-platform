/**
 * SSE Event Types
 */
export type SSEEventType =
  | "state"
  | "error"
  | "usage_limits"
  | "content_block_delta"
  | "content_block_stop"
  | "thinking_delta"
  | "signature_delta"
  | "message_start"
  | "message_delta"
  | "message_stop"
  | "content_block_start"
  | "tool_response_start"
  | "tool_response"
  | "tool_response_end"
  | "tool_use_start"
  | "tool_use_delta"
  | "tool_use_stop"
  // Claude web search streaming events
  | "server_tool_use"
  | "web_search_tool_result"
  | "web_search_tool_result_end";

/**
 * Tool Event Stages
 */
export enum ToolStage {
  START = "start",
  DELTA = "delta",
  STOP = "stop",
}

/**
 * Stream States
 */
export enum StreamState {
  INIT = "init",
  THINKING = "thinking",
  POST_PROCESSING = "post_processing",
  DONE = "done",
}

/**
 * Tool Call Types
 */
export enum ToolCallType {
  FUNCTION = "function",
}

/**
 * Tool Call Function Interface
 */
export interface ToolCallFunction {
  name: string;
  arguments: string;
}

/**
 * Tool Call Interface
 */
export interface ToolCall {
  id: string;
  type: ToolCallType;
  function: ToolCallFunction;
  index?: number;
}

/**
 * Parsed SSE Data Interface
 */
export interface ParsedSSEData {
  error?: string;
  choices?: Array<{
    delta?: {
      content?: string;
    };
  }>;
  index?: number;
  [key: string]: unknown;
}

/**
 * SSE Event Payload Interface
 */
export interface SSEEventPayload {
  [key: string]: unknown;
}

/**
 * Tool Event Payload Interface
 */
export interface ToolEventPayload extends SSEEventPayload {
  tool_id: string;
  tool_name?: string;
  parameters?: string;
}
