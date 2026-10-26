import {
  DISCOVER_WIND_DOWN_KIND,
  DISCOVER_WIND_DOWN_STORY_MINUTES,
  discoverWindDownContentSchema,
  type DiscoverWindDown,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { findDiscoverCard } from "~/modules/discover/domain/edition";
import { discoverStoryGroupId } from "~/modules/discover/domain/wind-down";
import { readOutputContent } from "~/modules/outputs/application/content";
import { OutputRepository } from "~/modules/outputs/infrastructure/OutputRepository";

import { requireDiscoverEdition } from "./editions";
import { retryDiscoverWindDown, startDiscoverWindDown } from "./wind-down";

export async function startDiscoverStory(
  context: ServiceContext,
  editionId: string,
  cardId: string,
): Promise<DiscoverWindDown> {
  const user = context.requireUser();
  const edition = await requireDiscoverEdition(context, user.id, editionId);
  const card = findDiscoverCard(edition.content.cards, cardId, "wind_down");

  if (!card) {
    throw new AssistantError("Discover card not found", ErrorType.NOT_FOUND, 404);
  }

  const groupId = discoverStoryGroupId(edition.id, card.id);
  const existing = await context.repositories
    .get(OutputRepository)
    .getPersonalOutputByGroup(user.id, groupId, DISCOVER_WIND_DOWN_KIND);
  const content = readOutputContent(
    existing,
    DISCOVER_WIND_DOWN_KIND,
    discoverWindDownContentSchema,
  );

  if (existing && content) {
    return content.status === "failed"
      ? retryDiscoverWindDown(context, existing, content, card.premise)
      : { ...content, id: existing.id };
  }

  return startDiscoverWindDown(
    context,
    {
      kind: "story",
      minutes: DISCOVER_WIND_DOWN_STORY_MINUTES,
      topic: card.topic,
      premise: card.premise,
    },
    groupId,
  );
}
