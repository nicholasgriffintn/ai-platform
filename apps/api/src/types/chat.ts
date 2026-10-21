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
  PolyRequest,
  PermissionMode,
  ResponseEventInput,
  RunProvenance,
  TeammateAutonomyLevel,
  TeammateApprovalStreak,
  ToolRule,
  TeammateStandingApproval,
  ToolPermission,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "../infrastructure/context/serviceContext";
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
  poly?: PolyRequest;
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
  settings_disabled_tools?: string[];
  verbosity?: VerbosityLevel;
  role?: ChatRole;
  run_id?: string;
  run_attempt?: number;
  teammate_context_id?: string;
  autonomy_level?: TeammateAutonomyLevel | null;
  standing_approvals?: TeammateStandingApproval[];
  approval_streaks?: TeammateApprovalStreak[];
  tool_rules?: ToolRule[];
  acting_rules_suspended?: boolean;
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
  autonomy_level?: TeammateAutonomyLevel | null;
  standing_approvals?: TeammateStandingApproval[];
  approval_streaks?: TeammateApprovalStreak[];
  tool_rules?: ToolRule[];
  acting_rules_suspended?: boolean;
  /** Derived from the person's settings on the server; never read from a request body. */
  settings_disabled_tools?: string[];
};

export type ChatCompletionParametersWithModel = ChatCompletionParameters;

export type CoreChatOptions = ChatCompletionParameters & {
  anonymousUser?: any;
  context?: ServiceContext;
  stream_prelude_events?: ResponseEventInput[];
};
