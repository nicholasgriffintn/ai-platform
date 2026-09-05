interface ConversationUnreadState {
  is_unread?: number | null;
  next_response_arrived?: number | null;
}

export function isConversationUnread(state: ConversationUnreadState | null | undefined): boolean {
  return state?.is_unread === 1 || state?.next_response_arrived === 1;
}
