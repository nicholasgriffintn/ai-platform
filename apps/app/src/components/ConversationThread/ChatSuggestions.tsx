import {
  ChatSuggestionList,
  type ComposerCommandAction,
} from "@ngriffin_uk/polychat-component-conversation";
import type { ModelConfigItem } from "@ngriffin_uk/polychat-schemas";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useTrackEvent } from "~/hooks/use-track-event";
import { useChatSuggestionContext } from "~/hooks/useChatSuggestionContext";
import { createChatSuggestions, type ChatSuggestion } from "~/lib/chat-suggestions";
import { useToolsStore } from "~/state/stores/toolsStore";
import { useUIStore } from "~/state/stores/uiStore";

interface ChatSuggestionsProps {
  setInput: (text: string) => void;
  suggestionsOverride?: ChatSuggestion[] | null;
  isLoading?: boolean;
  modeCommands?: ComposerCommandAction[];
  modelConfig?: ModelConfigItem;
  includeCapabilities?: boolean;
}

export const ChatSuggestions = ({
  setInput,
  suggestionsOverride,
  isLoading = false,
  modeCommands,
  modelConfig,
  includeCapabilities = true,
}: ChatSuggestionsProps) => {
  const { trackEvent } = useTrackEvent();
  const { isMobileLoading } = useUIStore();
  const toggleTool = useToolsStore((state) => state.toggleTool);
  const isToolEnabled = useToolsStore((state) => state.isToolEnabled);

  const hasOverride = suggestionsOverride !== undefined;
  const { context, isLoading: isLoadingContext } = useChatSuggestionContext({
    enabled: !hasOverride,
    includeCapabilities,
    modeCommands,
    modelConfig,
  });

  const [seed, setSeed] = useState<number | null>(null);
  const [seen, setSeen] = useState<ReadonlySet<string>>(() => new Set());

  useEffect(() => {
    setSeed(Math.random());
  }, []);

  const generated = useMemo(
    () => (seed === null ? [] : createChatSuggestions(context, seed, { exclude: seen })),
    [context, seed, seen],
  );
  const suggestions = suggestionsOverride ?? generated;

  const handleShuffle = useCallback(() => {
    trackEvent({
      name: "shuffle_suggestions",
      category: "conversation",
      properties: { count: String(generated.length) },
    });
    setSeen((current) => new Set([...current, ...generated.map((suggestion) => suggestion.id)]));
    setSeed(Math.random());
  }, [generated, trackEvent]);

  const handleSelect = useCallback(
    (suggestion: ChatSuggestion) => {
      const { action } = suggestion;

      trackEvent({
        name: "click_suggestion",
        category: "conversation",
        properties: {
          suggestion_id: suggestion.id,
          suggestion_category: suggestion.category,
          suggestion_tier: suggestion.tier ?? "override",
          suggestion_action: action?.type ?? "prompt",
        },
      });

      if (action?.type === "mode") {
        modeCommands?.find((command) => command.id === action.modeId)?.onSelect();
      }

      if (action?.type === "tool") {
        for (const toolId of action.toolIds) {
          if (!isToolEnabled(toolId)) {
            toggleTool(toolId);
          }
        }
      }

      if (suggestion.prompt) {
        setInput(suggestion.prompt);
      }
    },
    [isToolEnabled, modeCommands, setInput, toggleTool, trackEvent],
  );

  if (suggestionsOverride === null || (hasOverride && suggestions.length === 0)) {
    return null;
  }

  if (isLoading || isMobileLoading || isLoadingContext || (!hasOverride && seed === null)) {
    return <ChatSuggestionList suggestions={[]} isLoading onSelect={() => undefined} />;
  }

  return (
    <ChatSuggestionList
      suggestions={suggestions}
      showRefresh={!hasOverride}
      onRefresh={handleShuffle}
      onSelect={handleSelect}
    />
  );
};
