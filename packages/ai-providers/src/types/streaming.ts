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
