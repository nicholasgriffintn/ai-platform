import type { McpServerFieldValue } from "@ngriffin_uk/polychat-component-capabilities";
import type {
  AgentMode,
  TeammateOwnerScopeType,
  TeammateResponse,
  ModelConfig,
  SkillSummary,
  TeammateKind,
  Tool,
} from "@ngriffin_uk/polychat-schemas";
import type { ParsedNumberInput } from "@ngriffin_uk/polychat-utility-core";

import type { TeammateFormData } from "../types";

export interface TeammateEditorExample {
  id: string;
  input: string;
  output: string;
}

export interface TeammateEditorValue {
  name: string;
  kind: TeammateKind;
  description: string;
  avatarUrl: string;
  systemPrompt: string;
  examples: TeammateEditorExample[];
  mode: AgentMode | null;
  model: string;
  temperature: ParsedNumberInput;
  maxSteps: ParsedNumberInput;
  toolIds: string[];
  skillIds: string[];
  servers: McpServerFieldValue[];
}

export type TeammateEditorChange = (patch: Partial<TeammateEditorValue>) => void;

export interface TeammatePublishTarget {
  id: string;
  name: string;
}

export interface TeammatePublishState {
  workspaces: TeammatePublishTarget[];
  isPublishing: boolean;
  error?: string | null;
  onPublish: (workspaceId: string) => void;
}

export interface TeammateEditorProps {
  teammate: TeammateResponse | null;
  models: ModelConfig;
  tools: Tool[];
  skills: SkillSummary[];
  isLoadingCapabilities?: boolean;
  canManage: boolean;
  cannotManageReason?: string;
  isSaving: boolean;
  error?: string | null;
  ownerLabel: string;
  publish?: TeammatePublishState;
  onSubmit: (data: TeammateFormData) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

export interface TeammateAccessSectionProps {
  ownerScopeType: TeammateOwnerScopeType;
  ownerLabel: string;
  isSaved: boolean;
  publish?: TeammatePublishState;
}
