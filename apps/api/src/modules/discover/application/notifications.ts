import { DISCOVER_JOB_TASK_TYPE } from "@ngriffin_uk/polychat-schemas";
import {
  comparableHttpUrl,
  truncateSingleLine,
  uniqueBy,
} from "@ngriffin_uk/polychat-utility-core";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { isDiscoverQuiet } from "~/modules/discover/domain/day";
import { describeDiscoverCard, discoverTopicKey } from "~/modules/discover/domain/edition";
import { summariseDiscoverFeedback } from "~/modules/discover/domain/feedback";
import type { DiscoverLiveContent } from "~/modules/discover/domain/live";
import type { DiscoverNewsItem } from "~/modules/discover/domain/news-categories";
import {
  resolveDiscoverNotificationSubject,
  discoverNotificationContentSchema,
  type DiscoverNotificationRecord,
  type DiscoverNotificationTarget,
  selectDiscoverNewsAlertCandidate,
} from "~/modules/discover/domain/notifications";
import { DiscoverSeenRepository } from "~/modules/discover/infrastructure/DiscoverSeenRepository";
import { NotificationRepository } from "~/modules/notifications/infrastructure/NotificationRepository";
import { requirePolyContext } from "~/modules/poly/application/poly-context";
import { isPolyContextPaused } from "~/modules/poly/domain/pause";
import { TaskService } from "~/modules/queue/application/TaskService";
import { TaskRepository } from "~/modules/queue/infrastructure/TaskRepository";

import { listDiscoverAudio } from "./audio-releases";
import { readDiscoverDayProfile } from "./day-profile";
import { listDiscoverFeedback } from "./feedback";
import { listDiscoverFollows } from "./follows";
import { readDiscoverLive } from "./live-store";
import { readDiscoverRoutine } from "./settings";

export async function readDiscoverNotificationState(
  context: ServiceContext,
  id: string,
  options: { now?: Date; forDelivery?: boolean } = {},
) {
  const now = options.now ?? new Date();
  const user = context.requireUser();
  const [notification, settings, profile, live, briefings, poly] = await Promise.all([
    readDiscoverNotification(context, id),
    readDiscoverRoutine(context),
    readDiscoverDayProfile(context),
    readDiscoverLive(context),
    listDiscoverAudio(context),
    requirePolyContext(context),
  ]);
  const state = { notification, settings, profile, poly };

  if (!notification || !settings.enabled || !settings.installationId) {
    return { ...state, subject: null };
  }

  if (isPolyContextPaused(poly, now.getTime())) {
    return { ...state, subject: null };
  }

  let subject = resolveDiscoverNotificationSubject({ notification, profile, live, briefings, now });

  if (subject && notification?.category === "news") {
    const [follows, feedback, seen] = await Promise.all([
      listDiscoverFollows(context, user.id),
      listDiscoverFeedback(context, user.id),
      options.forDelivery
        ? context.repositories.get(DiscoverSeenRepository).list(user.id)
        : Promise.resolve(new Map<string, number>()),
    ]);
    const item = live.items.find((candidate) => candidate.id === notification.subjectId);
    const card = item?.card;
    const topic = card && "topic" in card ? discoverTopicKey(card.topic) : null;
    const followed = new Set(
      [...profile.topics, ...follows.map((follow) => follow.topic)].map(discoverTopicKey),
    );
    const muted = new Set(summariseDiscoverFeedback(feedback).hiddenTopics.map(discoverTopicKey));

    if (
      !topic ||
      !followed.has(topic) ||
      muted.has(topic) ||
      (item && (seen.get(item.id) ?? 0) >= item.revision)
    ) {
      subject = null;
    }
  }

  return { notification, subject, profile, settings, poly };
}

async function readDiscoverNotification(
  context: ServiceContext,
  id: string,
): Promise<DiscoverNotificationRecord | null> {
  const user = context.requireUser();
  const record = await context.repositories.get(NotificationRepository).get(user.id, id);
  const parsed = discoverNotificationContentSchema.safeParse(record?.payload);

  return record?.source === "discover" &&
    record.status !== "cancelled" &&
    !record.dismissedAt &&
    parsed.success
    ? { ...parsed.data, expiresAt: record.expiresAt }
    : null;
}

async function createDiscoverNotification(
  context: ServiceContext,
  input: {
    category: DiscoverNotificationRecord["category"];
    subjectId: string;
    fingerprint: string;
    profile: Awaited<ReturnType<typeof readDiscoverDayProfile>>;
    expiresAt: string;
    title: string;
    body: string;
    target: DiscoverNotificationTarget;
  },
) {
  const params = new URLSearchParams();

  if (input.target.itemId) {
    params.set("discoverItem", input.target.itemId);
  }

  if (input.target.briefingId) {
    params.set("discoverBriefing", input.target.briefingId);
  }

  if (input.target.observationId) {
    params.set("discoverObservation", input.target.observationId);
  }

  await context.repositories
    .get(NotificationRepository)
    .create(
      context.requireUser().id,
      `${input.profile.revision}:${input.category}:${input.subjectId}:${input.fingerprint}`,
      {
        source: "discover",
        title: truncateSingleLine(input.title, 160),
        body: input.body,
        deepLink: `/?${params}`,
        expiresAt: input.expiresAt,
        payload: {
          category: input.category,
          subjectId: input.subjectId,
          fingerprint: input.fingerprint,
          profileRevision: input.profile.revision,
          decision: "eligible",
        },
      },
    );
}

export async function scheduleDiscoverNotifications(
  context: ServiceContext,
  previous: DiscoverLiveContent,
  current: DiscoverLiveContent,
  now: Date,
  news: readonly DiscoverNewsItem[] = [],
): Promise<void> {
  const [profile, poly, settings, briefings] = await Promise.all([
    readDiscoverDayProfile(context),
    requirePolyContext(context),
    readDiscoverRoutine(context),
    listDiscoverAudio(context),
  ]);

  const repository = context.repositories.get(NotificationRepository);
  const user = context.requireUser();

  if (
    !settings.enabled ||
    !profile.notifications.enabled ||
    profile.notifications.dailyLimit === 0
  ) {
    await repository.cancelSource(user.id, "discover");

    return;
  }

  if (isPolyContextPaused(poly, now.getTime()) || isDiscoverQuiet(profile, now)) {
    return;
  }

  const [published, pending] = await Promise.all([
    repository.list(user.id, { source: "discover" }),
    repository.list(user.id, { source: "discover", pending: true }),
  ]);

  for (const existing of uniqueBy([...published, ...pending], (record) => record.id)) {
    const parsed = discoverNotificationContentSchema.safeParse(existing.payload);
    const subject = parsed.success
      ? resolveDiscoverNotificationSubject({
          notification: { ...parsed.data, expiresAt: existing.expiresAt },
          profile,
          live: current,
          briefings,
          now,
        })
      : null;

    if (!subject) {
      await repository.update(user.id, existing.id, { status: "cancelled" });
    }
  }

  for (const observation of current.observations) {
    const category =
      observation.kind === "travel" ? "commute" : observation.kind === "weather" ? "weather" : null;

    if (!category || !profile.notifications[category]) {
      continue;
    }

    if (
      !observation.actionable ||
      observation.stale ||
      observation.expiresAt <= now.toISOString()
    ) {
      continue;
    }

    if (
      previous.observations.some(
        (item) =>
          item.id === observation.id &&
          item.fingerprint === observation.fingerprint &&
          item.actionable,
      )
    ) {
      continue;
    }

    await createDiscoverNotification(context, {
      category,
      subjectId: observation.id,
      fingerprint: observation.fingerprint,
      profile,
      expiresAt: observation.expiresAt,
      title: observation.title,
      body: observation.text,
      target: { itemId: null, briefingId: null, observationId: observation.id },
    });
  }

  if (profile.notifications.briefings) {
    for (const release of briefings) {
      if (
        release.status !== "ready" ||
        !release.sourceId ||
        now.getTime() - Date.parse(release.createdAt) > 2 * 60 * 60 * 1000
      ) {
        continue;
      }

      await createDiscoverNotification(context, {
        category: "briefings",
        subjectId: release.id,
        fingerprint: release.sourceId,
        profile,
        expiresAt: new Date(Date.parse(release.createdAt) + 2 * 60 * 60 * 1000).toISOString(),
        title: "Your briefing is ready",
        body: "Catch up with your latest Discover podcast.",
        target: { itemId: null, observationId: null, briefingId: release.id },
      });
    }
  }

  if (profile.notifications.news) {
    const followed = new Set(
      [
        ...profile.topics,
        ...(await listDiscoverFollows(context, user.id)).map((follow) => follow.topic),
      ].map(discoverTopicKey),
    );
    const publicUrls = new Set(news.map((item) => comparableHttpUrl(item.url)).filter(Boolean));
    const candidate = selectDiscoverNewsAlertCandidate({
      current,
      previous,
      followed,
      publicUrls,
      now,
    });

    if (candidate) {
      await createDiscoverNotification(context, {
        category: "news",
        subjectId: candidate.id,
        fingerprint: candidate.fingerprint,
        profile,
        expiresAt: new Date(now.getTime() + 30 * 60 * 1000).toISOString(),
        title: describeDiscoverCard(candidate.card),
        body: "A timely update on a topic you follow.",
        target: { itemId: candidate.id, observationId: null, briefingId: null },
      });
    }
  }

  const taskService = new TaskService(context.env, new TaskRepository(context.env));

  for (const { id } of await repository.list(user.id, { source: "discover", pending: true })) {
    await taskService.enqueueTask({
      id: `discover_notification_${id}_${Math.floor(now.getTime() / (5 * 60 * 1000))}`,
      task_type: DISCOVER_JOB_TASK_TYPE,
      user_id: user.id,
      task_data: { job: "notification", notificationId: id },
      priority: 7,
    });
  }
}
