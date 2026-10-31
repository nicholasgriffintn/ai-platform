import { useToolsStore } from "@ngriffin_uk/polychat-library-client";
import {
  useTrackEvent,
  useChatSuggestionContext,
  createChatSuggestions,
  useStableRandomSeed,
  type ChatSuggestion,
  useUIStore,
} from "@ngriffin_uk/polychat-library-react";
import type { ModelConfigItem } from "@ngriffin_uk/polychat-schemas";
import type { ComposerCommandAction } from "@ngriffin_uk/polychat-utility-react";
import { useCallback, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";

import { ChatSuggestionList, type ChatSuggestionLayout } from "../ChatSuggestionList.js";

const PILL_SUGGESTION_COUNT = 3;

interface ChatSuggestionsProps {
  setInput: (text: string) => void;
  onSubmitPrompt?: (prompt: string) => void;
  suggestionsOverride?: ChatSuggestion[] | null;
  isLoading?: boolean;
  modeCommands?: ComposerCommandAction[];
  modelConfig?: ModelConfigItem;
  includeCapabilities?: boolean;
  layout?: ChatSuggestionLayout;
}

export const ChatSuggestions = ({
  setInput,
  onSubmitPrompt,
  suggestionsOverride,
  isLoading = false,
  modeCommands,
  modelConfig,
  includeCapabilities = true,
  layout,
}: ChatSuggestionsProps) => {
  const { trackEvent } = useTrackEvent();
  const { isMobileLoading } = useUIStore(
    useShallow((state) => ({ isMobileLoading: state.isMobileLoading })),
  );
  const toggleTool = useToolsStore((state) => state.toggleTool);
  const isToolEnabled = useToolsStore((state) => state.isToolEnabled);

  const hasOverride = suggestionsOverride !== undefined;
  const { context, isLoading: isLoadingContext } = useChatSuggestionContext({
    enabled: !hasOverride,
    includeCapabilities,
    modeCommands,
    modelConfig,
  });

  const stableSeed = useStableRandomSeed();
  const [seed, setSeed] = useState<number>(stableSeed);
  const [seen, setSeen] = useState<ReadonlySet<string>>(() => new Set());

  const generated = useMemo(
    () =>
      createChatSuggestions(context, seed, {
        exclude: seen,
        ...(layout === "pills" ? { count: PILL_SUGGESTION_COUNT } : {}),
      }),
    [context, layout, seed, seen],
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
        if (onSubmitPrompt) {
          onSubmitPrompt(suggestion.prompt);
        } else {
          setInput(suggestion.prompt);
        }
      }
    },
    [isToolEnabled, modeCommands, onSubmitPrompt, setInput, toggleTool, trackEvent],
  );

  if (suggestionsOverride === null || (hasOverride && suggestions.length === 0)) {
    return null;
  }

  if (isLoading || isMobileLoading || isLoadingContext) {
    return (
      <ChatSuggestionList suggestions={[]} isLoading layout={layout} onSelect={() => undefined} />
    );
  }

  return (
    <ChatSuggestionList
      suggestions={suggestions}
      showRefresh={!hasOverride}
      layout={layout}
      onRefresh={handleShuffle}
      onSelect={handleSelect}
    />
  );
};
