const DAY_MS = 24 * 60 * 60 * 1000;
const UNTITLED = new Set(["", "new conversation", "new chat", "untitled"]);

export interface DiscoverConversationSignal {
  title: string;
  type: string;
  updatedAt: string;
}

export function selectRecentChatTitles(
  conversations: readonly DiscoverConversationSignal[],
  options: { now: number; maxAgeDays: number; limit: number },
): string[] {
  const oldest = options.now - options.maxAgeDays * DAY_MS;
  const titles: string[] = [];
  const seen = new Set<string>();

  for (const conversation of conversations) {
    const title = conversation.title.trim();
    const updatedAt = Date.parse(conversation.updatedAt);

    if (
      conversation.type !== "chat" ||
      UNTITLED.has(title.toLowerCase()) ||
      !Number.isFinite(updatedAt) ||
      updatedAt < oldest ||
      seen.has(title.toLowerCase())
    ) {
      continue;
    }

    seen.add(title.toLowerCase());
    titles.push(title);

    if (titles.length >= options.limit) {
      break;
    }
  }

  return titles;
}
