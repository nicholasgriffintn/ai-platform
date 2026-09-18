export type SSEEventType =
  | "state"
  | "error"
  | "usage"
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
  | "tool_use_stop";

export enum ToolStage {
  START = "start",
  DELTA = "delta",
  STOP = "stop",
}

export enum StreamState {
  INIT = "init",
  THINKING = "thinking",
  POST_PROCESSING = "post_processing",
  DONE = "done",
}

export enum ToolCallType {
  FUNCTION = "function",
}

export interface ToolCallFunction {
  name: string;
  arguments: string;
}

export interface ToolCall {
  id: string;
  type: ToolCallType;
  function: ToolCallFunction;
  index?: number;
}

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

export type SSEEventPayload = Record<string, unknown>;

export interface ToolEventPayload extends SSEEventPayload {
  tool_id: string;
  tool_name?: string;
  parameters?: string;
}
