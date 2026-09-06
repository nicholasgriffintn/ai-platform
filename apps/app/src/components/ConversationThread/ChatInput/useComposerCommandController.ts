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
import { useChatStore } from "@ngriffin_uk/polychat-library-client";
import type { AssistantActionItem } from "@ngriffin_uk/polychat-schemas";
import { type ReactNode, useEffect, useMemo, useState } from "react";

import { useTeammates } from "~/hooks/useTeammates";
import { useTeammateToolDefaults } from "~/hooks/useTeammateToolDefaults";
import { useComposerDraft } from "~/state/composer-draft";

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
  const { chatMode, selectedTeammateId, selectedTeammateTokenPosition, selectedAssistantAction } =
    useChatStore();
  const { composerInput, setComposerInput } = useComposerDraft();
  const includeTeammates = assistantActionCatalog?.includeTeammates !== false;
  const { teammates } = useTeammates({ enabled: includeTeammates });
  const [textareaCursorPosition, setTextareaCursorPosition] = useState(0);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
  const selectedTeammate = teammates.find((teammate) => teammate.id === selectedTeammateId);
  const ignoredDirectiveRanges = useMemo(() => {
    const ranges: ComposerDirectiveIgnoredRange[] = [];

    if (selectedAssistantAction?.item) {
      const tokenText =
        selectedAssistantAction.tokenText ??
        getComposerInlineTokenText(selectedAssistantAction.item.label);

      ranges.push(
        ...findComposerInlineTokenRanges(
          composerInput,
          selectedAssistantAction.item.label,
          tokenText,
        ),
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

    if (selectedTeammate) {
      ranges.push(...findComposerInlineTokenRanges(composerInput, selectedTeammate.name));
      if (typeof selectedTeammateTokenPosition === "number") {
        ranges.push(
          getComposerInlineTokenRange(selectedTeammateTokenPosition, selectedTeammate.name),
        );
      }
    }

    return ranges;
  }, [composerInput, selectedTeammate, selectedTeammateTokenPosition, selectedAssistantAction]);
  const directiveQuery = getComposerDirectiveQuery(composerInput, textareaCursorPosition, {
    ignoredRanges: ignoredDirectiveRanges,
  });
  const modeCommands = modeControls?.commands ?? [];
  const commandActions = useComposerCommandActions({
    allowedAssistantActionCapabilities,
    assistantActionCatalog,
    chatInput: composerInput,
    directive: directiveQuery,
    goalState,
    includeSettingCommands: modeControls?.includeSettingCommands,
    modeCommands,
    setChatInput: setComposerInput,
    toolSelectionLocked,
  });

  useTeammateToolDefaults({
    teammates,
    selectedTeammateId,
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

    return composerInput.trim().toLowerCase() === selectedText;
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
      chatInput: composerInput,
      directive: directiveQuery,
      activeModeControls: modeControls?.activeModeControls,
      includeSettingCommands: modeControls?.includeSettingCommands,
      isDisabled: isLoading,
      modeCommands,
      setChatInput: setComposerInput,
      activeSuggestionIndex,
      onActiveSuggestionIndexChange: setActiveSuggestionIndex,
      onActionItemSelect: applyActionItem,
      onSlashCommandSelect: applySlashCommand,
      onSlashCommandBack: exitSlashSubmenu,
      clearTeammate: commandActions.clearTeammate,
      selectedTeammate: commandActions.selectedTeammate,
      toolSelectionLocked,
    },
    directiveQuery,
    moveActiveSuggestion,
    setTextareaCursorPosition,
  };
}
