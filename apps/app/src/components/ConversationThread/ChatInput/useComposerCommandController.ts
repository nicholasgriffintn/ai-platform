import { type ReactNode, useEffect, useMemo, useState } from "react";
import type { AssistantActionItem } from "@assistant/schemas";

import { useAgentToolDefaults } from "~/hooks/useAgentToolDefaults";
import { useAgents } from "~/hooks/useAgents";
import {
	type ComposerDirectiveIgnoredRange,
	findComposerInlineTokenRanges,
	getComposerDirectiveQuery,
	getComposerInlineTokenRange,
} from "~/lib/composer-commands";
import { useChatStore } from "~/state/stores/chatStore";
import type { ComposerCommandAction } from "./composerCommandTypes";
import { useComposerCommandActions } from "./useComposerCommandActions";

interface ComposerCommandControls {
	activeModeControls?: ReactNode;
	commands?: ComposerCommandAction[];
	includeSettingCommands?: boolean;
}

export function useComposerCommandController({
	isLoading,
	modeControls,
}: {
	isLoading: boolean;
	modeControls?: ComposerCommandControls;
}) {
	const {
		chatInput,
		setChatInput,
		chatMode,
		selectedAgentId,
		selectedAgentTokenPosition,
		selectedAssistantAction,
	} = useChatStore();
	const { chatAgents } = useAgents();
	const [textareaCursorPosition, setTextareaCursorPosition] = useState(0);
	const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
	const selectedAgent = chatAgents.find((agent) => agent.id === selectedAgentId);
	const ignoredDirectiveRanges = useMemo(() => {
		const ranges: ComposerDirectiveIgnoredRange[] = [];
		if (selectedAssistantAction?.item) {
			ranges.push(...findComposerInlineTokenRanges(chatInput, selectedAssistantAction.item.label));
			if (typeof selectedAssistantAction.tokenPosition === "number") {
				ranges.push(
					getComposerInlineTokenRange(
						selectedAssistantAction.tokenPosition,
						selectedAssistantAction.item.label,
					),
				);
			}
		}
		if (selectedAgent) {
			ranges.push(...findComposerInlineTokenRanges(chatInput, selectedAgent.name));
			if (typeof selectedAgentTokenPosition === "number") {
				ranges.push(getComposerInlineTokenRange(selectedAgentTokenPosition, selectedAgent.name));
			}
		}
		return ranges;
	}, [chatInput, selectedAgent, selectedAgentTokenPosition, selectedAssistantAction]);
	const directiveQuery = getComposerDirectiveQuery(chatInput, textareaCursorPosition, {
		ignoredRanges: ignoredDirectiveRanges,
	});
	const modeCommands = modeControls?.commands ?? [];
	const commandActions = useComposerCommandActions({
		chatInput,
		directive: directiveQuery,
		includeSettingCommands: modeControls?.includeSettingCommands,
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
			: commandActions.filteredActionItems.length;

	useEffect(() => {
		setActiveSuggestionIndex(0);
	}, [directiveQuery?.trigger, directiveQuery?.query, suggestionCount]);

	const applySlashCommand = (command: ComposerCommandAction) => {
		const selection = commandActions.selectSlashCommand(command);
		if (selection) {
			setTextareaCursorPosition(selection.cursorPosition);
		}
	};

	const applyActionItem = (item: AssistantActionItem) => {
		const selection = commandActions.selectActionItem(item);
		if (selection) {
			setTextareaCursorPosition(selection.cursorPosition);
		}
	};

	const isExactSelfInsertingSlashCommand = (command: ComposerCommandAction) => {
		if (!directiveQuery || directiveQuery.trigger !== "/" || !command.selectionText) {
			return false;
		}

		const selectedText = command.selectionText.trim().toLowerCase();
		return chatInput.trim().toLowerCase() === selectedText;
	};

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
			if (isExactSelfInsertingSlashCommand(command)) {
				return false;
			}
			applySlashCommand(command);
			return true;
		}

		const item = commandActions.filteredActionItems[activeSuggestionIndex];
		if (!item) {
			return false;
		}
		applyActionItem(item);
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
			includeSettingCommands: modeControls?.includeSettingCommands,
			isDisabled: isLoading,
			modeCommands,
			setChatInput,
			activeSuggestionIndex,
			onActiveSuggestionIndexChange: setActiveSuggestionIndex,
			onActionItemSelect: applyActionItem,
			onSlashCommandSelect: applySlashCommand,
			clearAgent: commandActions.clearAgent,
			selectedAgent: commandActions.selectedAgent,
		},
		directiveQuery,
		moveActiveSuggestion,
		setTextareaCursorPosition,
	};
}
