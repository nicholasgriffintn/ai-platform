import {
  isDiscoverListenResearching,
  type DiscoverEditionContent,
  type DiscoverListenResponse,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { chooseBriefingTopics } from "~/modules/discover/domain/briefing";
import {
  buildDiscoverListenMaterial,
  DISCOVER_LISTEN_FOCUS,
  DISCOVER_LISTEN_SHOW,
} from "~/modules/discover/domain/listen";
import { ensureFolder } from "~/modules/sources/application/folders";
import { startPodcastGeneration } from "~/modules/sources/application/podcasts/generate";
import { SourceRepository } from "~/modules/sources/infrastructure/SourceRepository";

import { ensureDiscoverBriefings } from "./briefings";
import { canAffordDiscoverListen } from "./cost";
import {
  requireDiscoverEdition,
  updateDiscoverEdition,
  withEditionRun,
  type StoredDiscoverEdition,
} from "./editions";
import { enqueueDiscoverJob } from "./jobs";
import { readDiscoverRoutine } from "./settings";

const LISTEN_SOURCE_LIMIT = 10;

async function readCurrentListen(
  context: ServiceContext,
  edition: StoredDiscoverEdition,
): Promise<string | null> {
  if (!edition.content.listenSourceId) {
    return null;
  }

  const current = await context.repositories
    .get(SourceRepository)
    .getSource(edition.content.listenSourceId);

  return current && current.status !== "failed" ? current.id : null;
}

async function requireListenBudget(context: ServiceContext): Promise<void> {
  const routine = await readDiscoverRoutine(context);

  if (!(await canAffordDiscoverListen(context, routine.installationId))) {
    throw new AssistantError(
      "This month's Discover budget is spent. Raise it in Discover settings.",
      ErrorType.PARAMS_ERROR,
      402,
    );
  }
}

function withoutListenRequest({
  listenRequestedAt: _requested,
  ...content
}: DiscoverEditionContent): DiscoverEditionContent {
  return content;
}

export async function queueDiscoverResearch(
  context: ServiceContext,
  edition: StoredDiscoverEdition,
  next: readonly ("listen" | "episode")[],
): Promise<void> {
  const listen = next.includes("listen");

  if (listen) {
    const requestedAt = new Date().toISOString();

    await updateDiscoverEdition(context, edition.id, (content) => ({
      ...content,
      listenRequestedAt: requestedAt,
    }));
  }

  try {
    await enqueueDiscoverJob(withEditionRun(context, edition), {
      job: "research",
      editionId: edition.id,
      next: [...next],
    });
  } catch (error) {
    if (listen) {
      await updateDiscoverEdition(context, edition.id, withoutListenRequest);
    }

    throw error;
  }
}

export async function requestDiscoverListen(
  context: ServiceContext,
  editionId: string,
): Promise<DiscoverListenResponse> {
  const user = context.requireUser();
  const edition = await requireDiscoverEdition(context, user.id, editionId);
  const current = await readCurrentListen(context, edition);

  if (current) {
    return { sourceId: current };
  }

  if (isDiscoverListenResearching(edition.content, Date.now())) {
    return { sourceId: null };
  }

  await requireListenBudget(context);
  await queueDiscoverResearch(context, edition, ["listen"]);

  return { sourceId: null };
}

export async function produceDiscoverListen(
  context: ServiceContext,
  editionId: string,
): Promise<DiscoverListenResponse> {
  const user = context.requireUser();
  const edition = await requireDiscoverEdition(context, user.id, editionId);
  const current = await readCurrentListen(context, edition);

  if (current) {
    return { sourceId: current };
  }

  try {
    await requireListenBudget(context);

    const { id: showId } = await ensureFolder(context, user.id, {
      projectId: null,
      title: DISCOVER_LISTEN_SHOW,
      kind: "podcast",
    });
    const briefings = await ensureDiscoverBriefings(
      context,
      edition,
      chooseBriefingTopics(edition.content),
    );
    const episode = await startPodcastGeneration(withEditionRun(context, edition), {
      sourceIds: [
        ...new Set([
          ...briefings.map((briefing) => briefing.sourceId),
          ...edition.content.cards.flatMap((card) =>
            card.kind === "read" && card.sourceId ? [card.sourceId] : [],
          ),
        ]),
      ].slice(0, LISTEN_SOURCE_LIMIT),
      material: buildDiscoverListenMaterial(edition.content),
      title: `${DISCOVER_LISTEN_SHOW}, ${edition.content.date}`,
      focus: DISCOVER_LISTEN_FOCUS,
      format: "deep_dive",
      length: "default",
      language: "en",
      showId,
    });

    await updateDiscoverEdition(context, editionId, (content) => ({
      ...withoutListenRequest(content),
      listenSourceId: episode.id,
    }));

    return { sourceId: episode.id };
  } catch (error) {
    await updateDiscoverEdition(context, editionId, withoutListenRequest);

    throw error;
  }
}
