import { readDiscoverCardSubject } from "@ngriffin_uk/polychat-library-chat";
import type { ConversationSubject } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { describeDiscoverCard } from "~/modules/discover/domain/edition";

import { requireDiscoverEdition } from "./editions";

export interface DiscoverCardSubjectContent {
  title: string;
  revision: number;
  text: string;
}

export async function requireDiscoverCardSubject(
  context: ServiceContext,
  userId: number,
  subject: ConversationSubject,
): Promise<DiscoverCardSubjectContent> {
  const reference = readDiscoverCardSubject(subject);

  if (!reference) {
    throw new AssistantError("Discover card not found", ErrorType.NOT_FOUND, 404);
  }

  const edition = await requireDiscoverEdition(context, userId, reference.editionId);
  const card = edition.content.cards.find((candidate) => candidate.id === reference.cardId);

  if (!card) {
    throw new AssistantError("Discover card not found", ErrorType.NOT_FOUND, 404);
  }

  return {
    title: describeDiscoverCard(card),
    revision: edition.revision,
    text: [
      `Kind: Discover ${card.kind} card from the ${edition.content.date} edition`,
      JSON.stringify(card, null, 2),
    ].join("\n\n"),
  };
}
