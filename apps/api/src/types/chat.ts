import type { VerbosityLevel } from "@ngriffin_uk/polychat-ai-models";
import type {
  ChatCompletionParameters as ProviderChatCompletionParameters,
  Attachment,
  ChatInput,
  ChatMode,
  ChatRole,
  Platform,
} from "@ngriffin_uk/polychat-ai-providers";
import type {
  AgentMode,
  ComputeSite,
  ConversationType,
  MetaAssistantRequest,
  PermissionMode,
  RunProvenance,
  ToolPermission,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "../lib/context/serviceContext";
import type { AnonymousUser } from "./anonymous-user";
import type { MemoryScope } from "./memory";
import type { IEnv } from "./shared";
import type { IUser } from "./user";

export type {
  AssistantMessageData,
  AssistantPersona,
  AssistantPersonaExample,
  AsyncInvocationContentHints,
  AsyncInvocationData,
  AsyncInvocationPollConfig,
  AsyncInvocationStatus,
  Attachment,
  ChatInput,
  ChatMode,
  ChatRequestOptions,
  ChatRole,
  ContentType,
  CreateChatCompletionsResponse,
  Message,
  MessageContent,
  MessageDataPayload,
  MessagePart,
  Platform,
  ProviderExecutionParams,
  ReasoningControls,
} from "@ngriffin_uk/polychat-ai-providers";

export interface IBody {
  completion_id: string;
  conversation_type?: ConversationType;
  meta_assistant?: MetaAssistantRequest;
  input: ChatInput;
  attachments?: Attachment[];
  date: string;
  location?: {
    latitude?: number;
    longitude?: number;
  };
  model?: string;
  provider?: string;
  platform?: Platform;
  mode?: ChatMode;
  compute_site?: ComputeSite;
  tool_policy_mode?: AgentMode;
  permission_mode?: PermissionMode;
  approved_tools?: string[];
  connector_approval_id?: string;
  tool_permissions_map?: Record<string, string[]>;
  require_approval_for?: ToolPermission[];
  denied_tools?: string[];
  verbosity?: VerbosityLevel;
  role?: ChatRole;
  run_id?: string;
  run_attempt?: number;
  teammate_context_id?: string;
  [other: string]: any;
}

export interface IRequest {
  app_url?: string;
  env: IEnv;
  request?: IBody;
  user?: IUser;
  anonymousUser?: AnonymousUser;
  mode?: ChatMode;
  compute_site?: ComputeSite;
  provenance?: RunProvenance | null;
  context?: ServiceContext;
  memoryScope?: MemoryScope;
}

export type ChatCompletionParameters = Omit<ProviderChatCompletionParameters, "env" | "context"> & {
  env: IEnv;
  context?: ServiceContext;
};

export type ChatCompletionParametersWithModel = ChatCompletionParameters;

export type CoreChatOptions = ChatCompletionParameters & {
  anonymousUser?: any;
  context?: ServiceContext;
};
