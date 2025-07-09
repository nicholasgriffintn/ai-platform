/**
 * SSE Event Types
 */
export enum SSEEventType {
  STATE = "state",
  ERROR = "error",
  USAGE_LIMITS = "usage_limits",
  CONTENT_BLOCK_DELTA = "content_block_delta",
  CONTENT_BLOCK_STOP = "content_block_stop",
  THINKING_DELTA = "thinking_delta",
  SIGNATURE_DELTA = "signature_delta",
  MESSAGE_START = "message_start",
  MESSAGE_DELTA = "message_delta",
  MESSAGE_STOP = "message_stop",
  CONTENT_BLOCK_START = "content_block_start",
  TOOL_RESPONSE_START = "tool_response_start",
  TOOL_RESPONSE = "tool_response",
  TOOL_RESPONSE_END = "tool_response_end",
  TOOL_USE_START = "tool_use_start",
  TOOL_USE_DELTA = "tool_use_delta",
  TOOL_USE_STOP = "tool_use_stop",
}

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
