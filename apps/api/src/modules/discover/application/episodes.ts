import { renderPrompt } from "@ngriffin_uk/polychat-ai-prompts";
import {
  DISCOVER_EPISODE_KIND,
  DISCOVER_EPISODES_CAPABILITY_ID,
  DISCOVER_SEASON_KIND,
  DISCOVER_SEASON_PARTS,
  DISCOVER_EPISODE_WATCHED_FRACTION,
  discoverEpisodeContentSchema,
  discoverEpisodeOutlineDraftSchema,
  discoverSeasonContentSchema,
  discoverSeasonPlanDraftSchema,
  type DiscoverEpisode,
  type DiscoverEpisodeContent,
  type DiscoverEpisodeResponse,
  type DiscoverSeasonContent,
} from "@ngriffin_uk/polychat-schemas";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { discoverTopicKey } from "~/modules/discover/domain/edition";
import {
  buildEpisodeChapters,
  describeSeasonPlan,
  discoverSeasonGroupId,
  episodeTarget,
  pickEpisodeTopic,
  readEpisodeFurthest,
  seasonNeedsReplacing,
} from "~/modules/discover/domain/episodes";
import { buildDiscoverListenMaterial } from "~/modules/discover/domain/listen";
import { requireNotebookAccess } from "~/modules/notebooks/application/access";
import { resolveNotebookSources } from "~/modules/notebooks/application/notebooks";
import {
  OutputRepository,
  type OutputRecord,
} from "~/modules/outputs/infrastructure/OutputRepository";
import { buildSourceMaterial } from "~/modules/sources/application/material";

import { affordableEpisodeLength } from "./cost";
import { enqueueDiscoverJob } from "./covers";
import { requireDiscoverEdition, withEditionRun } from "./editions";
import { publishDiscoverChanged } from "./events";
import { listDiscoverFollows } from "./follows";
import { generateDiscoverObject } from "./generate";
import { readDiscoverRoutine } from "./settings";

const MATERIAL_LIMIT = 60_000;

function readSeason(record: OutputRecord | null): DiscoverSeasonContent | null {
  const parsed = discoverSeasonContentSchema.safeParse(
    record ? safeParseJson(record.content) : null,
  );

  return parsed.success ? parsed.data : null;
}

export function readEpisodeRecord(record: OutputRecord | null): DiscoverEpisodeContent | null {
  if (!record || record.kind !== DISCOVER_EPISODE_KIND) {
    return null;
  }

  const parsed = discoverEpisodeContentSchema.safeParse(safeParseJson(record.content));

  return parsed.success ? parsed.data : null;
}

async function gatherMaterial(
  context: ServiceContext,
  topic: string,
  editionMaterial: string,
  notebookId: string | null,
): Promise<string> {
  if (!notebookId) {
    return editionMaterial;
  }

  const access = await requireNotebookAccess(context, notebookId);
  const sources = await resolveNotebookSources(context, access);

  return [
    editionMaterial,
    `# Notes and reading on ${topic}`,
    buildSourceMaterial(sources, MATERIAL_LIMIT),
  ].join("\n\n");
}

async function ensureSeason(
  context: ServiceContext,
  topic: string,
  style: DiscoverSeasonContent["style"],
  material: string,
): Promise<{ id: string; revision: number; season: DiscoverSeasonContent }> {
  const user = context.requireUser();
  const outputs = context.repositories.get(OutputRepository);
  const groupId = discoverSeasonGroupId(topic);
  const existing = await outputs.getPersonalOutputByGroup(user.id, groupId, DISCOVER_SEASON_KIND);
  const current = readSeason(existing);

  if (existing && current && !seasonNeedsReplacing(current)) {
    return { id: existing.id, revision: existing.revision, season: current };
  }

  const plan = await generateDiscoverObject(context, {
    name: "discover_season_plan",
    schema: discoverSeasonPlanDraftSchema,
    system: renderPrompt("discover/season/plan", {
      topic,
      parts: String(DISCOVER_SEASON_PARTS),
    }),
    material,
  });
  const season: DiscoverSeasonContent = {
    ...plan,
    format: "season",
    topic,
    style,
    nextPart: 1,
    episodeIds: [],
  };
  const record = existing
    ? await outputs.updateOutput(existing.id, {
        title: plan.title,
        content: season,
        expectedRevision: existing.revision,
        updatedByUserId: user.id,
      })
    : await outputs.createOutput({
        createdByUserId: user.id,
        capabilityId: DISCOVER_EPISODES_CAPABILITY_ID,
        groupId,
        kind: DISCOVER_SEASON_KIND,
        title: plan.title,
        sensitivity: "personal",
        content: season,
      });

  return { id: record.id, revision: record.revision, season };
}

async function recordEpisodeOutcome(
  context: ServiceContext,
  editionId: string,
  outcome: "failed" | "over_budget" | "retrying",
): Promise<void> {
  const user = context.requireUser();
  const latest = await requireDiscoverEdition(context, user.id, editionId);
  const { episodeFailed: _failed, episodeOverBudget: _overBudget, ...content } = latest.content;

  await context.repositories.get(OutputRepository).updateOutput(editionId, {
    content:
      outcome === "failed"
        ? { ...content, episodeFailed: true }
        : outcome === "over_budget"
          ? { ...content, episodeOverBudget: true }
          : content,
    expectedRevision: latest.revision,
    updatedByUserId: user.id,
  });
  await publishDiscoverChanged(context);
}

export async function produceDiscoverEpisode(
  context: ServiceContext,
  editionId: string,
): Promise<DiscoverEpisodeResponse | null> {
  try {
    return await scriptDiscoverEpisode(context, editionId);
  } catch (error) {
    await recordEpisodeOutcome(context, editionId, "failed");
    throw error;
  }
}

async function scriptDiscoverEpisode(
  context: ServiceContext,
  editionId: string,
): Promise<DiscoverEpisodeResponse | null> {
  const user = context.requireUser();
  const [edition, follows, settings] = await Promise.all([
    requireDiscoverEdition(context, user.id, editionId),
    listDiscoverFollows(context, user.id),
    readDiscoverRoutine(context),
  ]);

  if (edition.content.episodeId) {
    return { episodeId: edition.content.episodeId };
  }

  const topic = pickEpisodeTopic(edition.content, follows);

  if (!topic || settings.episode === "off") {
    throw new AssistantError("There is no topic for an episode yet", ErrorType.PARAMS_ERROR, 400);
  }

  const length = await affordableEpisodeLength(context, settings.installationId, settings.episode);

  if (!length) {
    await recordEpisodeOutcome(context, editionId, "over_budget");

    return null;
  }

  const notebookId =
    follows.find((follow) => discoverTopicKey(follow.topic) === discoverTopicKey(topic))
      ?.notebookId ?? null;
  const material = await gatherMaterial(
    context,
    topic,
    buildDiscoverListenMaterial(edition.content),
    notebookId,
  );
  const season = await ensureSeason(context, topic, settings.style, material);
  const target = episodeTarget(length);
  const part = season.season.nextPart;
  const script = await generateDiscoverObject(context, {
    name: "discover_episode_outline",
    schema: discoverEpisodeOutlineDraftSchema,
    system: renderPrompt("discover/episode/outline", {
      topic,
      part: `${part} of ${DISCOVER_SEASON_PARTS}`,
      minutes: String(target.minutes),
      plan: describeSeasonPlan(season.season),
    }),
    material,
  });
  const content: DiscoverEpisodeContent = {
    format: "episode",
    seasonId: season.id,
    editionId,
    notebookId,
    minutes: target.minutes,
    topic,
    part,
    parts: DISCOVER_SEASON_PARTS,
    style: season.season.style,
    title: script.title,
    recap: script.recap,
    chapters: buildEpisodeChapters(script),
  };
  const outputs = context.repositories.get(OutputRepository);
  const episode = await outputs.createOutput({
    createdByUserId: user.id,
    capabilityId: DISCOVER_EPISODES_CAPABILITY_ID,
    collectionId: notebookId,
    kind: DISCOVER_EPISODE_KIND,
    title: `${script.title} (part ${part})`,
    status: "pending",
    sensitivity: "personal",
    content,
  });

  await outputs.updateOutput(season.id, {
    content: {
      ...season.season,
      nextPart: part + 1,
      episodeIds: [...season.season.episodeIds, episode.id],
    },
    expectedRevision: season.revision,
    updatedByUserId: user.id,
  });

  for (const [chapter] of content.chapters.entries()) {
    await enqueueDiscoverJob(context, { job: "episode_chapter", episodeId: episode.id, chapter });
  }

  const latest = await requireDiscoverEdition(context, user.id, editionId);
  const { episodeFailed: _failed, ...editionContent } = latest.content;

  await outputs.updateOutput(editionId, {
    content: { ...editionContent, episodeId: episode.id },
    expectedRevision: latest.revision,
    updatedByUserId: user.id,
  });
  await publishDiscoverChanged(context);

  return { episodeId: episode.id };
}

export async function queueDiscoverEpisode(
  context: ServiceContext,
  editionId: string,
): Promise<{ queued: true }> {
  const settings = await readDiscoverRoutine(context);

  if (settings.episode === "off") {
    throw new AssistantError(
      "Episodes are switched off in Discover settings",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  const edition = await requireDiscoverEdition(context, context.requireUser().id, editionId);

  if (edition.content.episodeFailed || edition.content.episodeOverBudget) {
    await recordEpisodeOutcome(context, editionId, "retrying");
  }

  await enqueueDiscoverJob(withEditionRun(context, edition), { job: "episode", editionId });

  return { queued: true };
}

export async function loadEpisodeMaterial(
  context: ServiceContext,
  episode: DiscoverEpisodeContent,
): Promise<string> {
  const edition = await requireDiscoverEdition(
    context,
    context.requireUser().id,
    episode.editionId,
  );

  return gatherMaterial(
    context,
    episode.topic,
    buildDiscoverListenMaterial(edition.content),
    episode.notebookId,
  );
}

export async function requireDiscoverSeason(context: ServiceContext, seasonId: string) {
  const record = await context.repositories
    .get(OutputRepository)
    .getPersonalOutput(context.requireUser().id, seasonId);
  const season = record?.kind === DISCOVER_SEASON_KIND ? readSeason(record) : null;

  if (!season) {
    throw new AssistantError("Season not found", ErrorType.NOT_FOUND, 404);
  }

  return season;
}

export async function requireDiscoverEpisode(
  context: ServiceContext,
  episodeId: string,
): Promise<{ record: OutputRecord; content: DiscoverEpisodeContent }> {
  const user = context.requireUser();
  const record = await context.repositories
    .get(OutputRepository)
    .getPersonalOutput(user.id, episodeId);
  const content = readEpisodeRecord(record);

  if (!record || !content) {
    throw new AssistantError("Episode not found", ErrorType.NOT_FOUND, 404);
  }

  return { record, content };
}

export async function recordDiscoverEpisodeProgress(
  context: ServiceContext,
  episodeId: string,
  fraction: number,
): Promise<{ furthest: number }> {
  const user = context.requireUser();
  const { record } = await requireDiscoverEpisode(context, episodeId);
  const outputs = context.repositories.get(OutputRepository);
  const furthest = Math.max(
    fraction,
    readEpisodeFurthest(await outputs.readViewerState(record.id, user.id)),
  );

  await outputs.writeViewerState(record.id, user.id, { furthest });

  return { furthest };
}

export async function wasLatestEpisodeWatched(
  context: ServiceContext,
  userId: number,
): Promise<boolean> {
  const outputs = context.repositories.get(OutputRepository);
  const [latest] = await outputs.listPersonalOutputs(userId, DISCOVER_EPISODES_CAPABILITY_ID, {
    kind: DISCOVER_EPISODE_KIND,
    limit: 1,
  });

  return latest
    ? readEpisodeFurthest(await outputs.readViewerState(latest.id, userId)) >=
        DISCOVER_EPISODE_WATCHED_FRACTION
    : false;
}

export async function readDiscoverEpisode(
  context: ServiceContext,
  episodeId: string,
): Promise<DiscoverEpisode> {
  const { record, content } = await requireDiscoverEpisode(context, episodeId);

  return { ...content, id: record.id, createdAt: record.created_at };
}
