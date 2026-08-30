import type { AssistantActionItem, ProjectCapabilityKind } from "@ngriffin_uk/polychat-schemas";
import type { ReactNode } from "react";

export interface ComposerAssistantActionCapability {
  kind: ProjectCapabilityKind;
  capabilityId: string;
}

export interface ComposerActionCatalogConfig {
  includeAgents?: boolean;
  includeTools?: boolean;
  projectId?: string;
}

export interface ComposerAgentOption {
  id: string;
  name: string;
  description?: string;
  avatar_url?: string;
  model?: string;
  enabled_tools?: string[];
  is_team_agent?: boolean;
}

export interface ComposerCommandAction {
  id: string;
  label: string;
  description: string;
  command: string;
  icon: ReactNode;
  isActive: boolean;
  disabled?: boolean;
  disabledReason?: string;
  keepPopoverOpen?: boolean;
  selectionText?: string;
  selectionCursorOffset?: number;
  actionItem?: AssistantActionItem;
  options?: ComposerCommandAction[];
  onSelect: () => void;
}
