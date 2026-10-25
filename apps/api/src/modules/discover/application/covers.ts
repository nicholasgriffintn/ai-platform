import type { DiscoverCard, DiscoverEditionContent } from "@ngriffin_uk/polychat-schemas";
import { isoWeekKey, slugify } from "@ngriffin_uk/polychat-utility-core";
import { mapWithConcurrency } from "@ngriffin_uk/polychat-utility-server/async";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { getPrivateObjectResponse } from "~/infrastructure/storage/read-resource";
import { storeDrawnImage, TEXTLESS_PICTURE } from "~/modules/generate/application/stored-image";
import { OutputRepository } from "~/modules/outputs/infrastructure/OutputRepository";

import { requireDiscoverEdition } from "./editions";
import { publishDiscoverChanged } from "./events";

const COVER_CONCURRENCY = 2;
const COVER_WIDTH = 768;
const COVER_HEIGHT = 960;
const COVER_STYLE =
  "Painterly editorial illustration with rich colour, visible brushwork, warm cinematic light and a single clear subject";

function coverKey(userId: number, coverId: string): string {
  return `discover/${userId}/covers/${coverId}`;
}

function coverIdFor(topic: string, date: string): string {
  return `${slugify(topic, 60) || "topic"}-${isoWeekKey(date)}`;
}

export async function drawDiscoverCovers(context: ServiceContext, editionId: string) {
  const user = context.requireUser();
  const edition = await requireDiscoverEdition(context, user.id, editionId);
  const pending = edition.content.cards.filter(
    (card): card is Extract<DiscoverCard, { kind: "topic" }> =>
      card.kind === "topic" && !card.coverId,
  );
  const drawn = new Map<string, string>();

  await mapWithConcurrency(pending, COVER_CONCURRENCY, async (card) => {
    const coverId = coverIdFor(card.topic, edition.content.date);

    const stored = await storeDrawnImage(context, coverKey(user.id, coverId), {
      completionId: `discover-cover-${coverId}`,
      prompt: `${COVER_STYLE}. ${card.topic}: ${card.title}. ${card.angle} ${TEXTLESS_PICTURE}`,
      aspectRatio: "4:5",
      width: COVER_WIDTH,
      height: COVER_HEIGHT,
    });

    if (stored) {
      drawn.set(card.id, coverId);
    }
  });

  if (drawn.size === 0) {
    return 0;
  }

  const latest = await requireDiscoverEdition(context, user.id, editionId);
  const content: DiscoverEditionContent = {
    ...latest.content,
    cards: latest.content.cards.map((card) =>
      card.kind === "topic" && drawn.has(card.id) ? { ...card, coverId: drawn.get(card.id) } : card,
    ),
  };

  await context.repositories.get(OutputRepository).updateOutput(editionId, {
    content,
    expectedRevision: latest.revision,
    updatedByUserId: user.id,
  });
  await publishDiscoverChanged(context);

  return drawn.size;
}

export async function readDiscoverCover(
  context: ServiceContext,
  coverId: string,
  rangeHeader?: string | null,
): Promise<Response> {
  return getPrivateObjectResponse(
    context,
    coverKey(context.requireUser().id, coverId),
    { filename: coverId, mimeType: "image/png", notFound: "Cover not found" },
    rangeHeader,
  );
}
