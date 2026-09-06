import type { ConversationGroup } from "@ngriffin_uk/polychat-schemas";

export type ConversationSnoozeChoice = "tomorrow" | "next_response";

export interface ConversationSummary {
  id?: string;
  title?: string | null;
  isLocalOnly?: boolean;
  parentConversationId?: string | null;
  needsInput?: boolean;
  isStreaming?: boolean;
  isPinned?: boolean;
  isUnread?: boolean;
  group?: ConversationGroup | null;
}

export interface ConversationSection {
  id: string;
  title?: string;
  conversations: ConversationSummary[];
}
