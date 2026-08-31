import type {
  ComposerActionCatalogConfig,
  ComposerAssistantActionCapability,
  ComposerCommandAction,
} from "@ngriffin_uk/polychat-component-conversation";
import {
  type ComposerDirectiveIgnoredRange,
  findComposerInlineTokenRanges,
  getComposerDirectiveQuery,
  getComposerInlineTokenRange,
  getComposerInlineTokenText,
} from "@ngriffin_uk/polychat-library-chat/composer-commands";
import type { GoalCommand } from "@ngriffin_uk/polychat-library-chat/goal-command";
import type { AssistantActionItem } from "@ngriffin_uk/polychat-schemas";
import { type ReactNode, useEffect, useMemo, useState } from "react";

import { useAgents } from "~/hooks/useAgents";
import { useAgentToolDefaults } from "~/hooks/useAgentToolDefaults";
import { useChatStore } from "~/state/stores/chatStore";

import { useComposerCommandActions } from "./useComposerCommandActions";

interface ComposerCommandControls {
  activeModeControls?: ReactNode;
  commands?: ComposerCommandAction[];
  includeSettingCommands?: boolean;
}

export function useComposerCommandController({
  isLoading,
  allowedAssistantActionCapabilities,
  assistantActionCatalog,
  goalState,
  modeControls,
  onCursorPositionRequest,
  toolSelectionLocked,
}: {
  isLoading: boolean;
  goalState?: {
    canUseGoals: boolean;
    goal: { status: string } | null;
    onCommand?: (command: GoalCommand) => void;
  };
  allowedAssistantActionCapabilities?: readonly ComposerAssistantActionCapability[];
  assistantActionCatalog?: ComposerActionCatalogConfig;
  modeControls?: ComposerCommandControls;
  onCursorPositionRequest?: (position: number) => void;
  toolSelectionLocked?: boolean;
}) {
  const {
    chatInput,
    setChatInput,
    chatMode,
    selectedAgentId,
    selectedAgentTokenPosition,
    selectedAssistantAction,
  } = useChatStore();
  const includeAgents = assistantActionCatalog?.includeAgents !== false;
  const { agents } = useAgents({ enabled: includeAgents });
  const [textareaCursorPosition, setTextareaCursorPosition] = useState(0);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
  const selectedAgent = agents.find((agent) => agent.id === selectedAgentId);
  const ignoredDirectiveRanges = useMemo(() => {
    const ranges: ComposerDirectiveIgnoredRange[] = [];

    if (selectedAssistantAction?.item) {
      const tokenText =
        selectedAssistantAction.tokenText ??
        getComposerInlineTokenText(selectedAssistantAction.item.label);

      ranges.push(
        ...findComposerInlineTokenRanges(chatInput, selectedAssistantAction.item.label, tokenText),
      );
      if (typeof selectedAssistantAction.tokenPosition === "number") {
        ranges.push(
          getComposerInlineTokenRange(
            selectedAssistantAction.tokenPosition,
            selectedAssistantAction.item.label,
            tokenText,
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
    allowedAssistantActionCapabilities,
    assistantActionCatalog,
    chatInput,
    directive: directiveQuery,
    goalState,
    includeSettingCommands: modeControls?.includeSettingCommands,
    modeCommands,
    setChatInput,
    toolSelectionLocked,
  });

  useAgentToolDefaults({
    agents,
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
      onCursorPositionRequest?.(selection.cursorPosition);
    }
  };

  const applyActionItem = (item: AssistantActionItem) => {
    const selection = commandActions.selectActionItem(item);

    if (selection) {
      setTextareaCursorPosition(selection.cursorPosition);
      onCursorPositionRequest?.(selection.cursorPosition);
    }
  };

  const exitSlashSubmenu = () => {
    const selection = commandActions.exitSlashSubmenu();

    if (selection) {
      setTextareaCursorPosition(selection.cursorPosition);
      onCursorPositionRequest?.(selection.cursorPosition);
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
    commandActions,
    commandState: {
      allowedAssistantActionCapabilities,
      assistantActionCatalog,
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
      onSlashCommandBack: exitSlashSubmenu,
      clearAgent: commandActions.clearAgent,
      selectedAgent: commandActions.selectedAgent,
      toolSelectionLocked,
    },
    directiveQuery,
    moveActiveSuggestion,
    setTextareaCursorPosition,
  };
}
