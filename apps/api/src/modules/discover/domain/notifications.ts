import type { DiscoverAudioRelease, DiscoverDayProfile } from "@ngriffin_uk/polychat-schemas";
import z from "zod/v4";

import { discoverCommuteWindow, resolveDiscoverDay } from "./day";
import { discoverTopicKey } from "./edition";
import type { DiscoverLiveContent } from "./live";
import { discoverCardIdentity } from "./live";

export interface DiscoverNotificationTarget {
  itemId: string | null;
  briefingId: string | null;
  observationId: string | null;
}

export const discoverNotificationContentSchema = z.object({
  category: z.enum(["commute", "weather", "news", "briefings"]),
  subjectId: z.string(),
  fingerprint: z.string(),
  profileRevision: z.number().int(),
  decision: z.enum(["eligible", "approved", "not_urgent"]),
});
export type DiscoverNotificationRecord = z.infer<typeof discoverNotificationContentSchema> & {
  expiresAt: string;
};

export function resolveDiscoverNotificationSubject(input: {
  notification: DiscoverNotificationRecord;
  profile: DiscoverDayProfile;
  live: DiscoverLiveContent;
  briefings: readonly DiscoverAudioRelease[];
  now: Date;
}): DiscoverNotificationTarget | null {
  const { notification, profile, live, now } = input;

  if (
    notification.profileRevision !== profile.revision ||
    notification.decision === "not_urgent" ||
    notification.expiresAt <= now.toISOString()
  ) {
    return null;
  }

  if (notification.category === "briefings") {
    const release = input.briefings.find((item) => item.id === notification.subjectId);

    if (!release || release.sourceId !== notification.fingerprint || release.status !== "ready") {
      return null;
    }

    return { itemId: null, observationId: null, briefingId: release.id };
  }

  if (notification.category === "news") {
    const item = live.items.find((candidate) => candidate.id === notification.subjectId);

    if (!item || item.fingerprint !== notification.fingerprint) {
      return null;
    }

    if (item.dismissed || item.expiresAt <= now.toISOString()) {
      return null;
    }

    const topic = item && "topic" in item.card ? discoverTopicKey(item.card.topic) : null;

    if (!item || !topic || profile.mutedTopics.some((muted) => discoverTopicKey(muted) === topic)) {
      return null;
    }

    return { itemId: item.id, observationId: null, briefingId: null };
  }

  const observation = live.observations.find((item) => item.id === notification.subjectId);

  if (!observation || live.profileRevision !== profile.revision) {
    return null;
  }

  if (observation.fingerprint !== notification.fingerprint || !observation.actionable) {
    return null;
  }

  if (observation.stale || observation.expiresAt <= now.toISOString()) {
    return null;
  }

  if (
    notification.category === "commute" &&
    !discoverCommuteWindow(profile, resolveDiscoverDay(profile, now), now)
  ) {
    return null;
  }

  return { itemId: null, briefingId: null, observationId: observation.id };
}

export function selectDiscoverNewsAlertCandidate(input: {
  current: DiscoverLiveContent;
  previous: DiscoverLiveContent;
  followed: ReadonlySet<string>;
  publicUrls: ReadonlySet<string>;
  now: Date;
}) {
  return input.current.items.find((item) => {
    if (item.dismissed || !item.publishedAt) {
      return false;
    }

    if (!("topic" in item.card) || !input.followed.has(discoverTopicKey(item.card.topic))) {
      return false;
    }

    if (!input.publicUrls.has(discoverCardIdentity(item.card))) {
      return false;
    }

    if (
      input.previous.items.some((old) => old.id === item.id && old.fingerprint === item.fingerprint)
    ) {
      return false;
    }

    const age = input.now.getTime() - Date.parse(item.publishedAt);

    return Number.isFinite(age) && age >= 0 && age < 2 * 60 * 60 * 1000;
  });
}
