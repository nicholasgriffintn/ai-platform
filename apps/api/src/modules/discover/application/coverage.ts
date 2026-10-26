import { getPromptText } from "@ngriffin_uk/polychat-ai-prompts";
import {
  DISCOVER_COVERAGE_METADATA_KEY,
  DISCOVER_COVERAGE_MIN_ARTICLES,
  discoverCoverageDraftSchema,
  type Source,
} from "@ngriffin_uk/polychat-schemas";
import { sha256Hex } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import {
  buildDiscoverCoverageMaterial,
  listTopicArticleCards,
  renderDiscoverCoverage,
  type DiscoverCoverageArticle,
} from "~/modules/discover/domain/coverage";
import { findDiscoverCard } from "~/modules/discover/domain/edition";
import { DISCOVER_MODEL_TIER } from "~/modules/discover/domain/settings";
import { generateTierObject } from "~/modules/models/application/tier-object";
import { formatSource, requireSourceAccess } from "~/modules/sources/application/sources";
import { SourceRepository } from "~/modules/sources/infrastructure/SourceRepository";

import { requireDiscoverBudgetLeft } from "./cost";
import { requireDiscoverEdition, updateDiscoverEdition, withEditionRun } from "./editions";
import { ensureDiscoverNotebook } from "./notebook";
import { readDiscoverRoutine } from "./settings";
import { writeDiscoverDocument } from "./signal-documents";

async function coverageSourceId(
  userId: number,
  editionId: string,
  cardId: string,
): Promise<string> {
  return `discover_coverage_${(await sha256Hex(`${userId}:${editionId}:${cardId}`)).slice(0, 24)}`;
}

export async function compareDiscoverCoverage(
  context: ServiceContext,
  editionId: string,
  cardId: string,
): Promise<Source> {
  const user = context.requireUser();
  const sources = context.repositories.get(SourceRepository);
  const edition = await requireDiscoverEdition(context, user.id, editionId);
  const card = findDiscoverCard(edition.content.cards, cardId, "topic");

  if (!card) {
    throw new AssistantError("Discover card not found", ErrorType.NOT_FOUND, 404);
  }

  if (card.coverageSourceId) {
    const existing = await sources.getSource(card.coverageSourceId);

    if (existing?.created_by_user_id === user.id) {
      return formatSource(existing);
    }
  }

  const articles: (DiscoverCoverageArticle & { sourceId: string })[] = [];

  for (const read of listTopicArticleCards(edition.content.cards, card.topic)) {
    const source = read.sourceId
      ? await requireSourceAccess(context, user.id, read.sourceId).catch(() => null)
      : null;
    const content = source?.content?.trim();

    if (source && content) {
      articles.push({ sourceId: source.id, source: read.source, title: read.title, content });
    }
  }

  if (articles.length < DISCOVER_COVERAGE_MIN_ARTICLES) {
    throw new AssistantError(
      "Comparing coverage needs at least two articles on this topic",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  await requireDiscoverBudgetLeft(context, (await readDiscoverRoutine(context)).installationId);

  const coverage = await generateTierObject(withEditionRun(context, edition), {
    tier: DISCOVER_MODEL_TIER,
    name: "discover_coverage",
    schema: discoverCoverageDraftSchema,
    system: getPromptText("discover/coverage"),
    material: buildDiscoverCoverageMaterial(card.topic, articles),
  });
  const notebook = await ensureDiscoverNotebook(context);
  const id = await coverageSourceId(user.id, edition.id, card.id);

  await writeDiscoverDocument(context, notebook.id, {
    id,
    origin: "research",
    kind: "text",
    title: `Coverage: ${card.title}`.slice(0, 200),
    provider: null,
    content: renderDiscoverCoverage(coverage),
    metadata: {
      [DISCOVER_COVERAGE_METADATA_KEY]: {
        ...coverage,
        sourceIds: articles.map((article) => article.sourceId),
        generatedAt: new Date().toISOString(),
      },
    },
  });

  await updateDiscoverEdition(context, editionId, (content) => ({
    ...content,
    cards: content.cards.map((candidate) =>
      candidate.id === card.id && candidate.kind === "topic"
        ? { ...candidate, coverageSourceId: id }
        : candidate,
    ),
  }));

  return formatSource(await requireSourceAccess(context, user.id, id));
}
