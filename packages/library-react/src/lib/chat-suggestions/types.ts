import type { ChatSuggestion as ChatSuggestionView } from "@ngriffin_uk/polychat-utility-react";

import type { SelectableHomeChatModeId } from "../../lib/chatModes.js";
import type { FocusRole } from "../../lib/focus-role.js";

export type ChatSuggestionTier = "today" | "capability" | "focus" | "everyday";

export type ChatSuggestionAction =
  | { type: "mode"; modeId: SelectableHomeChatModeId }
  | { type: "tool"; toolIds: readonly string[] };

export interface ChatSuggestion extends ChatSuggestionView {
  tier?: ChatSuggestionTier;
  action?: ChatSuggestionAction;
}

export interface ChatSuggestionConnector {
  id: string;
  name: string;
}

export interface ChatSuggestionRecipe {
  id: string;
  title: string;
}

export interface ChatSuggestionToday {
  id: string;
  label: string;
  prompt: string;
}

export interface ChatSuggestionContext {
  today: readonly ChatSuggestionToday[];
  focusRole: FocusRole | null;
  availableModes: readonly SelectableHomeChatModeId[];
  availableToolIds: readonly string[];
  connectors: readonly ChatSuggestionConnector[];
  recipes: readonly ChatSuggestionRecipe[];
}

export interface ChatSuggestionDefinition extends Omit<ChatSuggestion, "tier"> {
  isEligible?: (context: ChatSuggestionContext) => boolean;
}

export const EMPTY_CHAT_SUGGESTION_CONTEXT: ChatSuggestionContext = {
  today: [],
  focusRole: null,
  availableModes: [],
  availableToolIds: [],
  connectors: [],
  recipes: [],
};
