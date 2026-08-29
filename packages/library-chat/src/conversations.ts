import type {
  ConversationActivityWindow,
  ConversationListOptions,
  ConversationSortBy,
} from "./conversation-types";

export type { ConversationListOptions };

const ACTIVITY_WINDOW_DAYS: Record<Exclude<ConversationActivityWindow, "all">, number> = {
  today: 1,
  week: 7,
  month: 30,
};

const UNTITLED_CONVERSATION = "New conversation";

export function conversationActivityCutoff(
  activity: ConversationActivityWindow | undefined,
  now: Date = new Date(),
): Date | null {
  if (!activity || activity === "all") {
    return null;
  }

  const cutoff = new Date(now);

  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - (ACTIVITY_WINDOW_DAYS[activity] - 1));

  return cutoff;
}

export interface ConversationSummary {
  id?: string;
  title: string;
  created_at?: string;
  updated_at?: string;
  last_message_at?: string;
  is_archived?: boolean;
}

interface ConversationMessage {
  role: string;
  content: unknown;
  reasoning?: { content?: string };
  parts?: Array<{ type: string; text?: string }>;
}

export interface ConversationWithMessages extends ConversationSummary {
  messages: ConversationMessage[];
  is_public?: boolean;
  share_id?: string;
}

function getConversationDate(
  conversation: ConversationSummary,
  sortBy: ConversationSortBy,
): number {
  const value =
    sortBy === "created"
      ? conversation.created_at
      : conversation.updated_at || conversation.last_message_at;

  return value ? new Date(value).getTime() : 0;
}

export function getConversationActivityDate(conversation: ConversationSummary): number {
  return getConversationDate(conversation, "updated");
}

export function compareConversationsBySort(
  a: ConversationSummary,
  b: ConversationSummary,
  sortBy: ConversationSortBy,
): number {
  if (sortBy === "title") {
    return (a.title || UNTITLED_CONVERSATION).localeCompare(
      b.title || UNTITLED_CONVERSATION,
      undefined,
      {
        sensitivity: "base",
      },
    );
  }

  return getConversationDate(b, sortBy) - getConversationDate(a, sortBy);
}

export function filterConversationsByListOptions<T extends ConversationSummary>(
  conversations: T[],
  options: ConversationListOptions = {},
  now: Date = new Date(),
): T[] {
  const archiveFilter = options.archived ?? "active";
  const query = options.query?.trim().toLowerCase();
  const sortBy = options.sortBy ?? "updated";
  const activityCutoff = conversationActivityCutoff(options.activity, now)?.getTime() ?? null;

  return conversations
    .filter((conversation) => {
      if (archiveFilter === "active" && conversation.is_archived) {
        return false;
      }

      if (archiveFilter === "archived" && !conversation.is_archived) {
        return false;
      }

      if (activityCutoff !== null && getConversationActivityDate(conversation) < activityCutoff) {
        return false;
      }

      if (!query) {
        return true;
      }

      return (conversation.title || UNTITLED_CONVERSATION).toLowerCase().includes(query);
    })
    .sort((a, b) => compareConversationsBySort(a, b, sortBy));
}

function hasRenderableMessagePayload(message: ConversationMessage): boolean {
  return Boolean(
    (typeof message.content === "string" && message.content.trim()) ||
    (Array.isArray(message.content) && message.content.length > 0) ||
    message.reasoning?.content?.trim() ||
    message.parts?.length,
  );
}

function hasVisibleTextPayload(message: ConversationMessage): boolean {
  if (typeof message.content === "string" && message.content.trim()) {
    return true;
  }

  if (Array.isArray(message.content)) {
    return message.content.some(
      (part) =>
        typeof part === "object" &&
        part !== null &&
        "type" in part &&
        part.type === "text" &&
        "text" in part &&
        typeof part.text === "string" &&
        part.text.trim(),
    );
  }

  return Boolean(message.parts?.some((part) => part.type === "text" && part.text?.trim()));
}

function cachedPayloadIsAhead(
  fetchedConversation: ConversationWithMessages,
  cachedConversation: ConversationWithMessages,
): boolean {
  return cachedConversation.messages.some((cachedMessage, index) => {
    const fetchedMessage = fetchedConversation.messages[index];

    if (cachedMessage.role !== fetchedMessage?.role) {
      return false;
    }

    return (
      (hasVisibleTextPayload(cachedMessage) && !hasVisibleTextPayload(fetchedMessage)) ||
      (hasRenderableMessagePayload(cachedMessage) && !hasRenderableMessagePayload(fetchedMessage))
    );
  });
}

export function preserveOptimisticMessages<T extends ConversationWithMessages>(
  fetchedConversation: T | null | undefined,
  cachedConversation: T | null | undefined,
): T | null {
  if (!fetchedConversation || !cachedConversation?.messages.length) {
    return fetchedConversation || cachedConversation || null;
  }

  const fetchedMessageCount = fetchedConversation.messages.length;
  const cachedMessageCount = cachedConversation.messages.length;

  if (
    cachedMessageCount < fetchedMessageCount ||
    (cachedMessageCount === fetchedMessageCount &&
      !cachedPayloadIsAhead(fetchedConversation, cachedConversation))
  ) {
    return fetchedConversation;
  }

  return {
    ...fetchedConversation,
    ...cachedConversation,
    is_public: fetchedConversation.is_public ?? cachedConversation.is_public,
    share_id: fetchedConversation.share_id ?? cachedConversation.share_id,
  };
}

export function createConversationId(createId: () => string = () => crypto.randomUUID()): string {
  return createId();
}

export function isLocallyCreatedConversation(
  conversationId: string,
  locallyCreatedConversationIds: Readonly<Record<string, true>>,
): boolean {
  return locallyCreatedConversationIds[conversationId];
}
