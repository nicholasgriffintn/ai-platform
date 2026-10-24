import type {
  ChatRunTrigger,
  ConversationNotebook,
  ConversationSubject,
  ConversationType,
  DelegationContext,
  DurableExecution,
  EngineRequest,
  ResponseSettings,
  TeammateApprovalStreak,
  TeammateAutonomyLevel,
  TeammateRunConfiguration,
  TeammateStandingApproval,
  ToolPermission,
} from "@ngriffin_uk/polychat-schemas";

import type { ChatCompletionParameters, Message } from "~/types";

export interface ResponseCommand {
  conversationId?: string;
  conversationType?: ConversationType;
  conversationSubject?: ConversationSubject;
  conversationNotebook?: ConversationNotebook;
  commandId?: string;
  runId?: string;
  messages: EngineRequest["messages"] | Message[];
  stream?: boolean;
  store?: boolean;
  settings?: ResponseSettings;
}

export interface TeammateRunAuthority {
  configuration: TeammateRunConfiguration;
  functionTools: NonNullable<ChatCompletionParameters["tools"]>;
  contextId?: string;
  autonomyLevel?: TeammateAutonomyLevel | null;
  standingApprovals?: TeammateStandingApproval[];
  approvalStreaks?: TeammateApprovalStreak[];
  actingRulesSuspended?: boolean;
  computerId?: string;
  delegationId?: string;
}

export interface ResponseAuthority {
  trigger?: ChatRunTrigger;
  delegationContext?: DelegationContext;
  durableExecution?: DurableExecution;
  commandPayload?: Record<string, unknown>;
  requireApprovalFor?: ToolPermission[];
  enforceModeToolPolicy?: boolean;
  autonomyCeiling?: TeammateAutonomyLevel;
  dryRun?: boolean;
  teammate?: TeammateRunAuthority;
}
