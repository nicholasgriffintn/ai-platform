import { type ReactNode, useEffect, useState } from "react";

import { useAgentToolDefaults } from "~/hooks/useAgentToolDefaults";
import { useAgents } from "~/hooks/useAgents";
import { getComposerDirectiveQuery } from "~/lib/composer-commands";
import { useChatStore } from "~/state/stores/chatStore";
import type { ComposerCommandAction } from "./composerCommandTypes";
import { useComposerCommandActions } from "./useComposerCommandActions";

interface ComposerCommandControls {
	activeModeControls?: ReactNode;
	commands?: ComposerCommandAction[];
}

export function useComposerCommandController({
	isLoading,
	modeControls,
}: {
	isLoading: boolean;
	modeControls?: ComposerCommandControls;
}) {
	const { chatInput, setChatInput, chatMode, selectedAgentId } = useChatStore();
	const { chatAgents } = useAgents();
	const [textareaCursorPosition, setTextareaCursorPosition] = useState(0);
	const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
	const directiveQuery = getComposerDirectiveQuery(chatInput, textareaCursorPosition);
	const modeCommands = modeControls?.commands ?? [];
	const commandActions = useComposerCommandActions({
		chatInput,
		directive: directiveQuery,
		modeCommands,
		setChatInput,
	});

	useAgentToolDefaults({
		agents: chatAgents,
		selectedAgentId,
		chatMode,
	});

	const suggestionCount =
		directiveQuery?.trigger === "/"
			? commandActions.filteredSlashCommands.length
			: commandActions.filteredAgents.length;

	useEffect(() => {
		setActiveSuggestionIndex(0);
	}, [directiveQuery?.trigger, directiveQuery?.query, suggestionCount]);

	const applyDirectiveSelection = () => {
		if (!directiveQuery) {
			return false;
		}

		if (directiveQuery.trigger === "/") {
			const command = commandActions.filteredSlashCommands[activeSuggestionIndex];
			if (!command) {
				return false;
			}
			if (command.disabled) {
				return false;
			}
			commandActions.selectSlashCommand(command);
			return true;
		}

		const agent = commandActions.filteredAgents[activeSuggestionIndex];
		if (!agent) {
			return false;
		}
		commandActions.selectAgent(agent);
		return true;
	};

	const moveActiveSuggestion = (delta: number) => {
		if (!directiveQuery || suggestionCount <= 0) {
			return false;
		}
		setActiveSuggestionIndex((current) => (current + delta + suggestionCount) % suggestionCount);
		return true;
	};

	return {
		applyDirectiveSelection,
		commandState: {
			chatInput,
			directive: directiveQuery,
			activeModeControls: modeControls?.activeModeControls,
			isDisabled: isLoading,
			modeCommands,
			setChatInput,
			activeSuggestionIndex,
			onActiveSuggestionIndexChange: setActiveSuggestionIndex,
		},
		directiveQuery,
		moveActiveSuggestion,
		setTextareaCursorPosition,
	};
}
