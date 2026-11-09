import {
  DISCOVER_JOB_TASK_TYPE,
  type DiscoverRefreshResponse,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { mergeDiscoverLiveItems } from "~/modules/discover/domain/live";
import { selectDiscoverNewsCategories } from "~/modules/discover/domain/news-categories";
import { listStoryIntakeArticles } from "~/modules/discover/domain/story-intake";
import { DiscoverSeenRepository } from "~/modules/discover/infrastructure/DiscoverSeenRepository";
import { requirePolyContext } from "~/modules/poly/application/poly-context";
import { isPolyContextPaused } from "~/modules/poly/domain/pause";
import { TaskService } from "~/modules/queue/application/TaskService";
import { TaskRepository } from "~/modules/queue/infrastructure/TaskRepository";
import { queueStoryIntake } from "~/modules/stories/application/intake";

import { readDiscoverDayProfile } from "./day-profile";
import { collectDiscoverLiveCandidates } from "./live-candidates";
import { gatherDiscoverObservations } from "./live-observations";
import { readDiscoverLive, updateDiscoverLive } from "./live-store";
import { readDiscoverNews } from "./news";
import { scheduleDiscoverNotifications } from "./notifications";
import { ensureDiscoverLiveSchedule } from "./schedule-upgrade";
import { readDiscoverRoutine } from "./settings";

export async function queueDiscoverCurrent(
  context: ServiceContext,
  now = new Date(),
): Promise<DiscoverRefreshResponse> {
  const user = context.requireUser();
  const [settings, profile, poly] = await Promise.all([
    readDiscoverRoutine(context),
    readDiscoverDayProfile(context),
    requirePolyContext(context),
  ]);

  if (!settings.enabled || !settings.installationId) {
    return { status: "not_enabled", taskId: null };
  }

  if (isPolyContextPaused(poly, now.getTime())) {
    return { status: "paused", taskId: null };
  }

  const bucket = Math.floor(now.getTime() / 60_000);

  await ensureDiscoverLiveSchedule(context, settings);
  const taskId = await new TaskService(context.env, new TaskRepository(context.env)).enqueueTask({
    id: `discover_current_${user.id}_${profile.revision}_${bucket}`,
    task_type: DISCOVER_JOB_TASK_TYPE,
    user_id: user.id,
    task_data: {
      job: "current",
      installationId: settings.installationId,
      scheduledAt: now.toISOString(),
    },
    priority: 6,
  });

  return { status: "queued", taskId };
}

export async function refreshDiscoverCurrent(
  context: ServiceContext,
  input: { installationId: string; scheduledAt?: string; assertOwned?: () => Promise<void> },
  now = new Date(),
): Promise<{ added: number; changed: boolean }> {
  const [settings, profile, previous, poly] = await Promise.all([
    readDiscoverRoutine(context),
    readDiscoverDayProfile(context),
    readDiscoverLive(context),
    requirePolyContext(context),
  ]);

  if (!settings.enabled || settings.installationId !== input.installationId) {
    return { added: 0, changed: false };
  }

  if (isPolyContextPaused(poly, now.getTime())) {
    return { added: 0, changed: false };
  }

  if (input.scheduledAt) {
    const age = now.getTime() - Date.parse(input.scheduledAt);

    if (!Number.isFinite(age) || age < 0 || age > 2 * 60 * 60 * 1000) {
      return { added: 0, changed: false };
    }
  }

  if (
    previous.profileRevision === profile.revision &&
    previous.checkedAt &&
    now.getTime() - Date.parse(previous.checkedAt) < 5 * 60 * 1000
  ) {
    await scheduleDiscoverNotifications(context, previous, previous, now);

    return { added: 0, changed: false };
  }

  const observations = await gatherDiscoverObservations(
    context,
    profile,
    settings,
    previous.profileRevision === profile.revision ? previous.observations : [],
    now,
  );
  const news = await readDiscoverNews(
    selectDiscoverNewsCategories(settings.newsCategoryIds),
    context.env.CACHE,
  );
  const candidates = await collectDiscoverLiveCandidates(context, profile, settings, news, now);
  const intake = listStoryIntakeArticles(news);

  if (intake.length > 0) {
    await queueStoryIntake(context.env, intake);
  }

  const dismissed = await context.repositories.get(DiscoverSeenRepository).dismissed(
    context.requireUser().id,
    candidates.map((candidate) => candidate.id),
  );
  const [latestProfile, latestSettings, latestPoly] = await Promise.all([
    readDiscoverDayProfile(context),
    readDiscoverRoutine(context),
    requirePolyContext(context),
  ]);

  if (latestProfile.revision !== profile.revision) {
    return { added: 0, changed: false };
  }

  if (!latestSettings.enabled || latestSettings.installationId !== input.installationId) {
    return { added: 0, changed: false };
  }

  if (isPolyContextPaused(latestPoly, Date.now())) {
    return { added: 0, changed: false };
  }

  await input.assertOwned?.();
  const saved = await updateDiscoverLive(context, (content) => {
    const merged = mergeDiscoverLiveItems(
      content,
      candidates.filter((candidate) => !dismissed.has(candidate.id)),
      now,
    );
    const changed =
      JSON.stringify(
        content.observations.map((observation) => [observation.id, observation.fingerprint]),
      ) !==
      JSON.stringify(observations.map((observation) => [observation.id, observation.fingerprint]));

    return {
      ...content,
      ...merged,
      observations,
      profileRevision: profile.revision,
      checkedAt: now.toISOString(),
      updatedAt: changed ? now.toISOString() : merged.updatedAt,
    };
  });
  const added = saved.sequence - previous.sequence;

  await scheduleDiscoverNotifications(context, previous, saved, now, news);

  context.getLogger({ prefix: "discover/current" }).info("Updated current Discover", {
    added,
    observations: observations.length,
    changed: saved.updatedAt !== previous.updatedAt,
  });

  return { added, changed: saved.updatedAt !== previous.updatedAt };
}
