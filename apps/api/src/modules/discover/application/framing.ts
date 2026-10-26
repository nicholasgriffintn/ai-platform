import { readSourceFraming, type Source } from "@ngriffin_uk/polychat-schemas";
import { sha256Hex } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { parseJsonRecord } from "@ngriffin_uk/polychat-utility-server/json";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { findDiscoverCard } from "~/modules/discover/domain/edition";
import { runKnowledgeEnricher } from "~/modules/knowledge/application/enrichment/run";
import { readKnowledgeText } from "~/modules/knowledge/application/intake/body";
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

  if (!card.sourceId) {
    throw new AssistantError(
      "Poly didn't keep a copy of this page, so there's nothing to examine",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  const source = await requireSourceAccess(context, user.id, card.sourceId, true);
  const framing = readSourceFraming(parseJsonRecord(source.metadata));

  if (
    !framing ||
    framing.contentHash !== (await sha256Hex(await readKnowledgeText(context, source)))
  ) {
    await requireDiscoverBudgetLeft(context, (await readDiscoverRoutine(context)).installationId);
  }

  return formatSource(
    await runKnowledgeEnricher(withEditionRun(context, edition), source.id, "framing"),
  );
}
