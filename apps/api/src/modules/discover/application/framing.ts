import { readSourceFraming, type Source } from "@ngriffin_uk/polychat-schemas";
import { sha256Hex } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { parseJsonRecord } from "@ngriffin_uk/polychat-utility-server/json";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { findDiscoverCard } from "~/modules/discover/domain/edition";
import { analyseArticleFraming } from "~/modules/experiences/application/articles/framing";
import { updateSourceRecord } from "~/modules/sources/application/media/metadata";
import { formatSource, requireSourceAccess } from "~/modules/sources/application/sources";

import { requireDiscoverBudgetLeft } from "./cost";
import { requireDiscoverEdition, withEditionRun } from "./editions";
import { readDiscoverRoutine } from "./settings";

export async function frameDiscoverArticle(
  context: ServiceContext,
  editionId: string,
  cardId: string,
): Promise<Source> {
  const user = context.requireUser();
  const edition = await requireDiscoverEdition(context, user.id, editionId);
  const card = findDiscoverCard(edition.content.cards, cardId, "read");

  if (!card) {
    throw new AssistantError("Discover card not found", ErrorType.NOT_FOUND, 404);
  }

  const source = card.sourceId
    ? await requireSourceAccess(context, user.id, card.sourceId, true)
    : null;
  const content = source?.content?.trim();

  if (!source || !content) {
    throw new AssistantError(
      "Poly didn't keep a copy of this page, so there's nothing to examine",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  const contentHash = await sha256Hex(content);

  if (readSourceFraming(parseJsonRecord(source.metadata))?.contentHash === contentHash) {
    return formatSource(source);
  }

  await requireDiscoverBudgetLeft(context, (await readDiscoverRoutine(context)).installationId);

  const { framing, editorial } = await analyseArticleFraming(
    withEditionRun(context, edition),
    content,
  );

  return formatSource(
    await updateSourceRecord(context, source, {
      framing: {
        ...framing,
        ...(editorial ? { grade: editorial.grade } : {}),
        contentHash,
        generatedAt: new Date().toISOString(),
      },
    }),
  );
}
