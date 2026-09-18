import type { ExecutionContext } from "@cloudflare/workers-types";
import type { CredentialAuthority, ReasoningEffortLevel } from "@ngriffin_uk/polychat-ai-models";
import type {
  ChatCompletionRequestBody as SchemaChatCompletionRequestBody,
  ChatCompletionResponseBody as SchemaChatCompletionResponseBody,
  ChatRequestOptions as SchemaChatRequestOptions,
  AgentMode,
  ConversationType,
  MessageRole as SchemaMessageRole,
  MessagePart as SchemaMessagePart,
  RecipeConnectorProvider,
  RunProvenance,
  InferenceImpact,
  ChatMessageSelection,
  DelegationContext,
  ChatRunTrigger,
  ToolPermission,
} from "@ngriffin_uk/polychat-schemas";

import type { ProviderEnv, ProviderRequestContext } from "../env.js";
import type { ToolDefinitionLike } from "../tool-definitions.js";

export type Platform = string;

export type ContentType =
  | "text"
  | "image_url"
  | "audio_url"
  | "video_url"
  | "input_audio"
  | "thinking"
  | "document_url"
  | "markdown_document"
  | "selection"
  | "file"
  | "tool_result";
export type ChatRole = SchemaMessageRole;
export type ChatMode = string;
export type MessagePart = SchemaMessagePart;

export interface ReasoningControls {
  effort?: ReasoningEffortLevel;
}

export type MessageContent = {
  type: ContentType;
  source_id?: string;
  text?: string;
  image_url?: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
  audio_url?: {
    url: string;
  };
  video_url?: {
    url: string;
  };
  input_audio?: {
    data?: string;
    format?: "wav" | "mp3";
  };
  document_url?: {
    url: string;
    name?: string;
  };
  markdown_document?: {
    markdown: string;
    name?: string;
  };
  selection?: ChatMessageSelection;
  thinking?: string;
  signature?: string;
  image?: number[] | string;
  tool_use_id?: string;
  id?: string;
  name?: string;
  content?: string;
  input?: string | Record<string, unknown>;
  cache_control?: {
    type: "ephemeral";
  };
  prompt_cache_breakpoint?: {
    mode: "explicit";
  };
};

export type Attachment = {
  type: "image" | "document" | "markdown_document" | "audio" | "video";
  url?: string;
  detail?: "low" | "high";
  name?: string;
  markdown?: string;
  sourceId?: string;
};

export type AsyncInvocationStatus = "in_progress" | "completed" | "failed";

export interface AsyncInvocationContentHints {
  placeholder?: MessageContent[];
  progress?: MessageContent[];
  failure?: MessageContent[];
}

export interface AsyncInvocationPollConfig {
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  body?: Record<string, any>;
  query?: Record<string, string>;
  intervalMs?: number;
}

export interface AsyncInvocationData {
  provider: string;
  id: string;
  type?: string;
  poll?: AsyncInvocationPollConfig;
  pollIntervalMs?: number;
  status?: AsyncInvocationStatus | string;
  lastCheckedAt?: number;
  completedAt?: number;
  initialResponse?: Record<string, any>;
  context?: Record<string, any>;
  contentHints?: AsyncInvocationContentHints;
  [key: string]: any;
}

export interface MessageDataPayload extends Record<string, any> {
  codingTaskType?: string;
  asyncInvocation?: AsyncInvocationData;
  error?: string;
}

export interface Message {
  role: ChatRole;
  name?: string;
  tool_calls?: Record<string, any>[];
  parts?: MessagePart[];
  content: string | MessageContent[] | Record<string, unknown>;
  status?: string;
  data?: MessageDataPayload | null;
  completion_id?: string;
  run_id?: string;
  delegation_context?: DelegationContext;
  created?: number;
  model?: string;
  provider?: string;
  log_id?: string;
  citations?: string[];
  app?: string;
  mode?: ChatMode;
  id?: string;
  parent_message_id?: string;
  tool_call_id?: string;
  tool_call_arguments?: string | Record<string, any>;
  timestamp?: number;
  platform?: Platform;
  usage?: Record<string, any>;
  provenance?: RunProvenance | null;
}

export type ChatInput = string | { prompt: string };

export interface AssistantPersonaExample {
  input: string;
  output: string;
}

export interface AssistantPersona {
  name?: string;
  instructions?: string;
  examples?: AssistantPersonaExample[];
}

export type ProviderExecutionParams = {
  credentialAuthority?: CredentialAuthority;
  conversation_type?: ConversationType;
  trigger?: ChatRunTrigger;
  teammate_context_id?: string;
  computer_id?: string;
  delegation_id?: string;
  resolved_configuration?: Record<string, unknown>;
  persona?: AssistantPersona;
  min_tokens?: number;
  current_step?: number;
  command_payload?: Record<string, unknown>;
  app_url?: string;
  env: ProviderEnv;
  context?: ProviderRequestContext;
  connectedConnectorProviders?: RecipeConnectorProvider[];
  executionCtx?: ExecutionContext;
  analyticsTrackingEnabled?: boolean | null;
  version?: string;
  disable_functions?: boolean;
  conversation_history_write_mode?: "reconcile" | "append";
  messages?: Message[];
  tools?: Record<string, any>[];
  available_functions?: ToolDefinitionLike[];
  deferred_functions?: ToolDefinitionLike[];
  thinking?: {
    type: "enabled" | "disabled";
    budget_tokens?: number;
  };
  message?: string;
  prompt?: string;
  suffix?: string;
  fim_mode?: boolean;
  edit_operation?: "next" | "apply";
  location?: {
    latitude: number;
    longitude: number;
  };
  lang?: string;
  body?: Record<string, any>;
  require_approval_for?: ToolPermission[];
  denied_tools?: string[];
  tool_policy_mode?: AgentMode;
  enforce_mode_tool_policy?: boolean;
  durable_execution?:
    | {
        kind: "project_task";
        dispatchTaskId: string;
        executionOwnerToken: string;
      }
    | {
        kind: "delegation";
        maxCreditMicros: number;
      };
};

export type ChatRequestOptions = SchemaChatRequestOptions;

type RuntimeChatRequestFields = "messages" | "tools" | "user";

export type ChatCompletionParametersWithModel = Omit<
  SchemaChatCompletionRequestBody,
  RuntimeChatRequestFields
> &
  ProviderExecutionParams;

export type ChatCompletionParameters = Omit<
  SchemaChatCompletionRequestBody,
  RuntimeChatRequestFields
> &
  ProviderExecutionParams;

export type CreateChatCompletionsResponse = SchemaChatCompletionResponseBody;

export interface AssistantMessageData {
  content: string | MessageContent[];
  thinking?: string;
  signature?: string;
  citations?: any[];
  tool_calls?: any[];
  data?: any;
  usage?: any;
  impact?: InferenceImpact | null;
  guardrails?: {
    passed: boolean;
    error?: string;
    violations?: any[];
  };
  log_id?: string | null;
  model?: string;
  provider?: string;
  selected_models?: string[];
  platform?: Platform;
  timestamp?: number;
  id?: string;
  finish_reason?: string;
  mode?: ChatMode;
  refusal?: string | null;
  annotations?: unknown;
  provenance?: RunProvenance | null;
}
