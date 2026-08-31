import type {
  AgentMode,
  AgentOwnerScopeType,
  AgentResponse,
  ModelConfig,
  SkillSummary,
  Tool,
} from "@ngriffin_uk/polychat-schemas";
import type { ParsedNumberInput } from "@ngriffin_uk/polychat-utility-core";

import type { AgentFormData } from "../types";

export interface AgentEditorServer {
  id: string;
  url: string;
  type: "sse" | "stdio";
}

export interface AgentEditorExample {
  id: string;
  input: string;
  output: string;
}

export interface AgentEditorValue {
  name: string;
  description: string;
  avatarUrl: string;
  systemPrompt: string;
  examples: AgentEditorExample[];
  mode: AgentMode | null;
  model: string;
  temperature: ParsedNumberInput;
  maxSteps: ParsedNumberInput;
  toolIds: string[];
  skillIds: string[];
  servers: AgentEditorServer[];
}

export type AgentEditorChange = (patch: Partial<AgentEditorValue>) => void;

export interface AgentPublishTarget {
  id: string;
  name: string;
}

export interface AgentPublishState {
  workspaces: AgentPublishTarget[];
  isPublishing: boolean;
  error?: string | null;
  onPublish: (workspaceId: string) => void;
}

export interface AgentEditorProps {
  agent: AgentResponse | null;
  models: ModelConfig;
  tools: Tool[];
  skills: SkillSummary[];
  isLoadingCapabilities?: boolean;
  canManage: boolean;
  cannotManageReason?: string;
  isSaving: boolean;
  error?: string | null;
  ownerLabel: string;
  publish?: AgentPublishState;
  onSubmit: (data: AgentFormData) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

export interface AgentAccessSectionProps {
  ownerScopeType: AgentOwnerScopeType;
  ownerLabel: string;
  isSaved: boolean;
  publish?: AgentPublishState;
}
