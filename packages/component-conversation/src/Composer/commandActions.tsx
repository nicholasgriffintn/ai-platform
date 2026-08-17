import { createContext, type ReactNode, useContext } from "react";

import type { AssistantActionItem, AssistantActionSelection } from "@ngriffin_uk/polychat-schemas";

import type { ComposerAgentOption, ComposerCommandAction } from "../composerCommandTypes";

/**
 * Command resolution reads agents, capability catalogues, and chat settings, so the host owns it
 * and supplies the result. The composer surface only presents and emits selections.
 */
export interface ComposerCommandActions {
	agents: ComposerAgentOption[];
	actionItems: AssistantActionItem[];
	canUseAgents: boolean;
	clearAgent: () => void;
	filteredActionItems: AssistantActionItem[];
	filteredSlashCommands: ComposerCommandAction[];
	isLoadingAgents: boolean;
	modeCommands: ComposerCommandAction[];
	selectActionItem: (item: AssistantActionItem) => void;
	selectAgent: (agent: ComposerAgentOption) => void;
	selectSlashCommand: (command: ComposerCommandAction) => void;
	selectedAssistantAction: AssistantActionSelection | null;
	selectedAgent?: ComposerAgentOption | null;
	selectedAgentId?: string | null;
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
