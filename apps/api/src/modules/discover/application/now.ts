import type {
  DiscoverDayProfile,
  DiscoverNow,
  DiscoverObservation,
  DiscoverSettings,
} from "@ngriffin_uk/polychat-schemas";
import { sha256Hex, truncateSingleLine } from "@ngriffin_uk/polychat-utility-core";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { resolveDiscoverDay } from "~/modules/discover/domain/day";
import {
  listDiscoverFeedProviders,
  presentDiscoverNow,
  type DiscoverLiveContent,
} from "~/modules/discover/domain/live";
import { loadPolyAgenda } from "~/modules/poly/application/read-agenda";

export async function readDiscoverNow(
  context: ServiceContext,
  input: {
    live: DiscoverLiveContent;
    profile: DiscoverDayProfile;
    sources: DiscoverSettings["sources"];
    now: Date;
  },
): Promise<DiscoverNow> {
  const { live, profile, sources, now } = input;
  const allowed = listDiscoverFeedProviders(sources);
  const agenda = await loadPolyAgenda(context.repositories, context.requireUser().id);
  const priorities: DiscoverObservation[] = await Promise.all(
    agenda.needs_you.slice(0, 3).map(async (item) => ({
      id: `priority:${item.id}`,
      kind: "priority",
      title: "Waiting on you",
      text: truncateSingleLine(item.title, 1000),
      source: "Your Poly agenda",
      href: `/chat/${encodeURIComponent(item.conversation_id)}`,
      observedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
      actionable: true,
      fingerprint: await sha256Hex(`${item.id}:${item.status}`),
      stale: false,
    })),
  );
  const observations =
    live.profileRevision === profile.revision
      ? live.observations.filter(
          (item) => item.kind !== "priority" && (!item.providerId || allowed.has(item.providerId)),
        )
      : [];

  return presentDiscoverNow(
    {
      ...live,
      observations: [...priorities, ...observations].slice(0, 16),
      checkedAt: live.profileRevision === profile.revision ? live.checkedAt : null,
    },
    resolveDiscoverDay(profile, now),
    now,
  );
}
