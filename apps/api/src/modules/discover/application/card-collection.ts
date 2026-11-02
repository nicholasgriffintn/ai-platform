import { ownsResource } from "@ngriffin_uk/polychat-library-policy";
import {
  DISCOVER_LIVE_KIND,
  DISCOVER_EDITION_VERSION,
  type DiscoverEditionContent,
} from "@ngriffin_uk/polychat-schemas";
import { describeZonedInstant } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { OutputRepository } from "~/modules/outputs/infrastructure/OutputRepository";

import { readDiscoverDayProfile } from "./day-profile";
import {
  requireDiscoverEdition,
  updateDiscoverEdition,
  type StoredDiscoverEdition,
} from "./editions";
import { readDiscoverLive, updateDiscoverLive } from "./live-store";

export async function requireDiscoverCardCollection(
  context: ServiceContext,
  userId: number,
  collectionId: string,
): Promise<StoredDiscoverEdition> {
  const record = await context.repositories
    .get(OutputRepository)
    .getPersonalOutput(userId, collectionId);

  if (record?.kind !== DISCOVER_LIVE_KIND) {
    return requireDiscoverEdition(context, userId, collectionId);
  }

  if (
    !ownsResource(context.requireUser().id, record.created_by_user_id) ||
    record.project_id !== null
  ) {
    throw new AssistantError("Discover card not found", ErrorType.NOT_FOUND, 404);
  }

  const [profile, live] = await Promise.all([
    readDiscoverDayProfile(context),
    readDiscoverLive(context),
  ]);

  return {
    id: record.id,
    revision: record.revision,
    content: {
      version: DISCOVER_EDITION_VERSION,
      date: describeZonedInstant(new Date(), profile.timezone).date,
      timezone: profile.timezone,
      greeting: "Discover",
      interests: [],
      brief: [],
      cards: live.items.map((item) => item.card),
      generatedAt: live.updatedAt ?? record.created_at,
    },
  };
}

export async function updateDiscoverCardCollection(
  context: ServiceContext,
  collectionId: string,
  change: (content: DiscoverEditionContent) => DiscoverEditionContent,
): Promise<void> {
  const user = context.requireUser();
  const record = await context.repositories
    .get(OutputRepository)
    .getPersonalOutput(user.id, collectionId);

  if (record?.kind !== DISCOVER_LIVE_KIND) {
    return updateDiscoverEdition(context, collectionId, change);
  }

  const collection = await requireDiscoverCardCollection(context, user.id, collectionId);

  await updateDiscoverLive(context, (live) => {
    const cards = new Map(
      change({ ...collection.content, cards: live.items.map((item) => item.card) }).cards.map(
        (card) => [card.id, card],
      ),
    );

    return {
      ...live,
      items: live.items.map((item) => ({ ...item, card: cards.get(item.card.id) ?? item.card })),
    };
  });
}
