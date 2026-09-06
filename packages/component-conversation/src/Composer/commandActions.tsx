import type { AssistantActionItem, AssistantActionSelection } from "@ngriffin_uk/polychat-schemas";
import { createContext, type ReactNode, useContext } from "react";

import type { ComposerTeammateOption, ComposerCommandAction } from "../composerCommandTypes";

/**
 * Command resolution reads agents, capability catalogues, and chat settings, so the host owns it
 * and supplies the result. The composer surface only presents and emits selections.
 */
export interface ComposerCommandActions {
  activeSlashCommand: ComposerCommandAction | null;
  agents: ComposerTeammateOption[];
  actionItems: AssistantActionItem[];
  canUseTeammates: boolean;
  clearTeammate: () => void;
  exitSlashSubmenu: () => void;
  filteredActionItems: AssistantActionItem[];
  filteredSlashCommands: ComposerCommandAction[];
  isLoadingTeammates: boolean;
  modeCommands: ComposerCommandAction[];
  selectActionItem: (item: AssistantActionItem) => void;
  selectTeammate: (agent: ComposerTeammateOption) => void;
  selectSlashCommand: (command: ComposerCommandAction) => void;
  selectedAssistantAction: AssistantActionSelection | null;
  selectedTeammate?: ComposerTeammateOption | null;
  selectedTeammateId?: string | null;
  settingCommands: ComposerCommandAction[];
  slashCommands: ComposerCommandAction[];
}

const ComposerCommandActionsContext = createContext<ComposerCommandActions | null>(null);

export function ComposerCommandActionsProvider({
  actions,
  children,
}: {
  actions: ComposerCommandActions;
  children: ReactNode;
}) {
  return (
    <ComposerCommandActionsContext.Provider value={actions}>
      {children}
    </ComposerCommandActionsContext.Provider>
  );
}

export function useComposerCommandActions(): ComposerCommandActions {
  const actions = useContext(ComposerCommandActionsContext);

  if (!actions) {
    throw new Error(
      "Composer command surfaces must be rendered inside a ComposerCommandActionsProvider",
    );
  }

  return actions;
}
