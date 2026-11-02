import type { TaskSteps } from "@ngriffin_uk/polychat-ai-workflows";
import { ownsResource } from "@ngriffin_uk/polychat-library-policy";
import {
  DISCOVER_AUDIO_KIND,
  DISCOVER_CAPABILITY_ID,
  DISCOVER_EDITION_VERSION,
  discoverAudioReleaseSchema,
  type DiscoverAudioRelease,
  type DiscoverEditionContent,
} from "@ngriffin_uk/polychat-schemas";
import { describeZonedInstant } from "@ngriffin_uk/polychat-utility-core";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { summariseDiscoverFeedback } from "~/modules/discover/domain/feedback";
import {
  DISCOVER_LISTEN_SHOW,
  buildDiscoverListenMaterial,
} from "~/modules/discover/domain/listen";
import { presentDiscoverFeed } from "~/modules/discover/domain/live";
import { readOutputContent } from "~/modules/outputs/application/content";
import { OutputRepository } from "~/modules/outputs/infrastructure/OutputRepository";
import { requirePolyContext } from "~/modules/poly/application/poly-context";
import { isPolyContextPaused } from "~/modules/poly/domain/pause";
import { ensureFolder } from "~/modules/sources/application/folders";
import {
  preparePodcastGeneration,
  runPodcastGeneration,
} from "~/modules/sources/application/podcasts/generate";
import { SourceRepository } from "~/modules/sources/infrastructure/SourceRepository";

import {
  beginDiscoverBackgroundWork,
  assertDiscoverBackgroundWorkCurrent,
  finishDiscoverBackgroundWork,
} from "./background-work";
import { canAffordDiscoverListen } from "./cost";
import { readDiscoverDayProfile } from "./day-profile";
import { listRecentDiscoverEditions, updateDiscoverEdition } from "./editions";
import { publishDiscoverChanged } from "./events";
import { listDiscoverFeedback } from "./feedback";
import { readDiscoverLive } from "./live-store";
import { readDiscoverRoutine, readDiscoverSettings } from "./settings";

export async function listDiscoverAudio(context: ServiceContext): Promise<DiscoverAudioRelease[]> {
  const user = context.requireUser();
  const records = await context.repositories
    .get(OutputRepository)
    .listPersonalOutputs(user.id, DISCOVER_CAPABILITY_ID, { kind: DISCOVER_AUDIO_KIND, limit: 14 });
  const releases = records.flatMap((record) => {
    const release = readOutputContent(record, DISCOVER_AUDIO_KIND, discoverAudioReleaseSchema);

    return release ? [release] : [];
  });
  const sources = new Map(
    (
      await context.repositories
        .get(SourceRepository)
        .getSourcesByIds(
          releases.flatMap((release) => (release.sourceId ? [release.sourceId] : [])),
        )
    ).map((source) => [source.id, source]),
  );

  return releases.map((release) => {
    const source = release.sourceId ? sources.get(release.sourceId) : null;
    const status =
      source && ownsResource(user.id, source.created_by_user_id) && source.project_id === null
        ? source.status === "available"
          ? "ready"
          : source.status === "failed"
            ? "failed"
            : "pending"
        : release.status;

    return { ...release, status };
  });
}

export async function produceDiscoverAudio(
  context: ServiceContext,
  input: {
    installationId: string;
    date: string;
    slot: "morning" | "evening";
    assertOwned: () => Promise<void>;
    steps: TaskSteps;
  },
  now = new Date(),
): Promise<void> {
  const user = context.requireUser();
  const [settings, profile, live, editions, poly] = await Promise.all([
    readDiscoverRoutine(context),
    readDiscoverDayProfile(context),
    readDiscoverLive(context),
    listRecentDiscoverEditions(context, user.id, 4),
    requirePolyContext(context),
  ]);

  if (!settings.enabled || settings.installationId !== input.installationId) {
    return;
  }

  if (!settings.listen || !profile.audio[input.slot].enabled) {
    return;
  }

  if (isPolyContextPaused(poly, now.getTime())) {
    return;
  }

  if (describeZonedInstant(now, profile.timezone).date !== input.date) {
    return;
  }

  const id = `discover_audio_${user.id}_${input.date}_${input.slot}`;
  const groupId = `discover:audio:${input.date}:${input.slot}`;
  const outputs = context.repositories.get(OutputRepository);
  const existing = await outputs.getPersonalOutputByGroup(user.id, groupId, DISCOVER_AUDIO_KIND);
  const previous = existing
    ? readOutputContent(existing, DISCOVER_AUDIO_KIND, discoverAudioReleaseSchema)
    : null;

  if (previous?.sourceId) {
    const source = await context.repositories.get(SourceRepository).getSource(previous.sourceId);

    if (
      source &&
      ownsResource(user.id, source.created_by_user_id) &&
      source.project_id === null &&
      source.status !== "processing"
    ) {
      return;
    }
  }

  const edition = editions.find(
    (candidate) =>
      candidate.content.date === input.date &&
      (candidate.content.edition ?? "morning") === input.slot,
  );

  const available = await readDiscoverSettings(context);
  const allowedProviders = new Set(
    available.sources
      .filter((source) => source.connected && source.used)
      .map((source) => source.providerId),
  );
  const mutedTopics = [
    ...profile.mutedTopics,
    ...summariseDiscoverFeedback(await listDiscoverFeedback(context, user.id)).hiddenTopics,
  ];
  const content: DiscoverEditionContent = {
    version: DISCOVER_EDITION_VERSION,
    date: input.date,
    timezone: profile.timezone,
    greeting: input.slot === "morning" ? "Your day ahead" : "Your evening catch-up",
    interests: edition?.content.interests ?? [],
    brief: live.observations
      .filter(
        (observation) =>
          live.profileRevision === profile.revision &&
          observation.expiresAt > now.toISOString() &&
          !observation.stale &&
          (!observation.providerId || allowedProviders.has(observation.providerId)),
      )
      .slice(0, 5)
      .map((observation) => ({
        kind:
          observation.kind === "calendar" || observation.kind === "weather"
            ? observation.kind
            : "note",
        label: observation.title,
        text: observation.text,
        href: observation.href,
      })),
    cards: presentDiscoverFeed(live, {
      seen: new Map(),
      mutedTopics,
      allowedProviders,
      limit: 16,
      now,
    }).data.map((item) => item.card),
    generatedAt: now.toISOString(),
  };

  if (content.cards.length === 0 && content.brief.length === 0) {
    return;
  }

  const affordable =
    Boolean(previous?.sourceId) || (await canAffordDiscoverListen(context, input.installationId));
  const release: DiscoverAudioRelease = {
    id,
    date: input.date,
    slot: input.slot,
    editionId: edition?.id ?? null,
    sourceId: null,
    status: affordable ? "pending" : "over_budget",
    createdAt: previous?.createdAt ?? now.toISOString(),
  };

  let backgroundContext: ServiceContext | null = null;

  if (affordable) {
    await input.assertOwned();
    const [latestSettings, latestProfile, latestPoly] = await Promise.all([
      readDiscoverRoutine(context),
      readDiscoverDayProfile(context),
      requirePolyContext(context),
    ]);

    if (!latestSettings.enabled || latestSettings.installationId !== input.installationId) {
      return;
    }

    if (!latestSettings.listen || !latestProfile.audio[input.slot].enabled) {
      return;
    }

    if (
      latestProfile.revision !== profile.revision ||
      isPolyContextPaused(latestPoly, Date.now())
    ) {
      return;
    }

    const show = await ensureFolder(context, user.id, {
      projectId: null,
      title: DISCOVER_LISTEN_SHOW,
      kind: "podcast",
    });
    const sourceId = `discover_audio_source_${user.id}_${input.date}_${input.slot}`;

    backgroundContext = await beginDiscoverBackgroundWork(context, {
      id: `discover_audio_activity_${user.id}_${input.date}_${input.slot}`,
      installationId: input.installationId,
      data: {
        operation: "audio",
        sourceId,
        date: input.date,
        slot: input.slot,
        profileRevision: profile.revision,
        expiresAt: new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(),
      },
    });
    const episode = await preparePodcastGeneration(
      backgroundContext,
      {
        sourceIds: [
          ...new Set(
            content.cards.flatMap((card) =>
              card.kind === "read" && card.sourceId ? [card.sourceId] : [],
            ),
          ),
        ].slice(0, 10),
        material: buildDiscoverListenMaterial(content),
        title: `${DISCOVER_LISTEN_SHOW}, ${input.slot}, ${input.date}`,
        focus: `A source-backed ${input.slot} conversation for one listener. Explain meaningful developments and practical priorities. Use only the supplied material, identify uncertainty and keep dated or stale information out.`,
        format: "deep_dive",
        length: "default",
        language: "en",
        showId: show.id,
      },
      { sourceId },
    );

    release.sourceId = episode.id;

    if (edition) {
      await updateDiscoverEdition(context, edition.id, (current) => ({
        ...current,
        listenSourceId: episode.id,
      }));
    }
  }

  if (existing) {
    await outputs.updateOutput(existing.id, {
      content: release,
      expectedRevision: existing.revision,
      updatedByUserId: user.id,
    });
  } else {
    await outputs.createOutput({
      id,
      createdByUserId: user.id,
      capabilityId: DISCOVER_CAPABILITY_ID,
      groupId,
      kind: DISCOVER_AUDIO_KIND,
      title: `${input.slot} briefing, ${input.date}`,
      sensitivity: "personal",
      content: release,
    });
  }

  await publishDiscoverChanged(context);

  if (backgroundContext && release.sourceId && backgroundContext.executionActivityId) {
    const generationContext = backgroundContext;
    const activityId = backgroundContext.executionActivityId;
    const sourceId = release.sourceId;
    const outcome = await runPodcastGeneration(
      generationContext,
      sourceId,
      input.steps,
      async () => {
        await input.assertOwned();
        await assertDiscoverBackgroundWorkCurrent(generationContext, activityId, sourceId);
      },
    );

    if (outcome !== "skipped") {
      await finishDiscoverBackgroundWork(
        generationContext,
        outcome === "ready" ? "succeeded" : "failed",
      );
    }

    await publishDiscoverChanged(context);
  }
}
