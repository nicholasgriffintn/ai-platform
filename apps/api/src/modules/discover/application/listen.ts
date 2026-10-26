import type { DiscoverListenResponse } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import {
  buildDiscoverListenMaterial,
  DISCOVER_LISTEN_FOCUS,
  DISCOVER_LISTEN_SHOW,
} from "~/modules/discover/domain/listen";
import { ensureFolder } from "~/modules/sources/application/folders";
import { startPodcastGeneration } from "~/modules/sources/application/podcasts/generate";
import { SourceRepository } from "~/modules/sources/infrastructure/SourceRepository";

import { canAffordDiscoverListen } from "./cost";
import { requireDiscoverEdition, updateDiscoverEdition, withEditionRun } from "./editions";
import { readDiscoverRoutine } from "./settings";

const LISTEN_ARTICLE_LIMIT = 8;

export async function produceDiscoverListen(
  context: ServiceContext,
  editionId: string,
): Promise<DiscoverListenResponse> {
  const user = context.requireUser();
  const edition = await requireDiscoverEdition(context, user.id, editionId);

  if (edition.content.listenSourceId) {
    const current = await context.repositories
      .get(SourceRepository)
      .getSource(edition.content.listenSourceId);

    if (current && current.status !== "failed") {
      return { sourceId: current.id };
    }
  }

  const routine = await readDiscoverRoutine(context);

  if (!(await canAffordDiscoverListen(context, routine.installationId))) {
    throw new AssistantError(
      "This month's Discover budget is spent. Raise it in Discover settings.",
      ErrorType.PARAMS_ERROR,
      402,
    );
  }

  const { id: showId } = await ensureFolder(context, user.id, {
    projectId: null,
    title: DISCOVER_LISTEN_SHOW,
    kind: "podcast",
  });
  const episode = await startPodcastGeneration(withEditionRun(context, edition), {
    sourceIds: edition.content.cards
      .flatMap((card) => (card.kind === "read" && card.sourceId ? [card.sourceId] : []))
      .slice(0, LISTEN_ARTICLE_LIMIT),
    material: buildDiscoverListenMaterial(edition.content),
    title: `${DISCOVER_LISTEN_SHOW}, ${edition.content.date}`,
    focus: DISCOVER_LISTEN_FOCUS,
    format: "brief",
    length: "short",
    language: "en",
    showId,
  });

  await updateDiscoverEdition(context, editionId, (content) => ({
    ...content,
    listenSourceId: episode.id,
  }));

  return { sourceId: episode.id };
}
