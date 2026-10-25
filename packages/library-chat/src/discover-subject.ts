import type { ConversationSubject, DiscoverCard } from "@ngriffin_uk/polychat-schemas";

const DISCOVER_CARD_SUBJECT_SEPARATOR = ":";

export interface DiscoverCardReference {
  editionId: string;
  cardId: string;
}

export function discoverCardSubject(editionId: string, card: DiscoverCard): ConversationSubject {
  if (card.kind === "read" && card.sourceId) {
    return { type: "source", id: card.sourceId };
  }

  return {
    type: "discover_card",
    id: `${editionId}${DISCOVER_CARD_SUBJECT_SEPARATOR}${card.id}`,
  };
}

export function readDiscoverCardSubject(
  subject: ConversationSubject,
): DiscoverCardReference | null {
  if (subject.type !== "discover_card") {
    return null;
  }

  const [editionId, cardId, ...rest] = subject.id.split(DISCOVER_CARD_SUBJECT_SEPARATOR);

  if (!editionId || !cardId || rest.length > 0) {
    return null;
  }

  return { editionId, cardId };
}
