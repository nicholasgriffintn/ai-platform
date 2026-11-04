import type {
  DiscoverFeedPage,
  DiscoverFeedQuery,
  DiscoverSeenRequest,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { collectCardSignals, summariseDiscoverFeedback } from "~/modules/discover/domain/feedback";
import { listDiscoverFeedProviders, presentDiscoverFeed } from "~/modules/discover/domain/live";
import { DiscoverSeenRepository } from "~/modules/discover/infrastructure/DiscoverSeenRepository";

import { readDiscoverDayProfile } from "./day-profile";
import { publishDiscoverChanged } from "./events";
import { listDiscoverFeedback } from "./feedback";
import { readDiscoverLive, updateDiscoverLive, discoverLiveId } from "./live-store";
import { readDiscoverSettings } from "./settings";

export async function readDiscoverFeed(
  context: ServiceContext,
  query: DiscoverFeedQuery,
): Promise<DiscoverFeedPage> {
  const user = context.requireUser();
  const [content, profile, seen, feedback, settings] = await Promise.all([
    readDiscoverLive(context),
    readDiscoverDayProfile(context),
    context.repositories.get(DiscoverSeenRepository).list(user.id),
    listDiscoverFeedback(context, user.id),
    readDiscoverSettings(context),
  ]);

  return presentDiscoverFeed(content, {
    ...query,
    seen,
    mutedTopics: [...profile.mutedTopics, ...summariseDiscoverFeedback(feedback).hiddenTopics],
    allowedProviders: listDiscoverFeedProviders(settings.sources),
    feedback: collectCardSignals(feedback, discoverLiveId(user.id)),
    now: new Date(),
  });
}

export async function markDiscoverSeen(
  context: ServiceContext,
  input: DiscoverSeenRequest,
): Promise<{ updated: number }> {
  const user = context.requireUser();
  const content = await readDiscoverLive(context);
  const accepted = input.items.filter((receipt) =>
    content.items.some((item) => item.id === receipt.id && item.revision === receipt.revision),
  );

  for (const receipt of accepted) {
    await context.repositories
      .get(DiscoverSeenRepository)
      .mark(user.id, receipt.id, receipt.revision);
  }

  if (accepted.length > 0) {
    await publishDiscoverChanged(context);
  }

  return { updated: accepted.length };
}

export async function dismissDiscoverItem(
  context: ServiceContext,
  itemId: string,
): Promise<{ updated: number }> {
  let updated = 0;
  const current = await readDiscoverLive(context);

  if (!current.items.some((item) => item.id === itemId)) {
    throw new AssistantError("Discover item not found", ErrorType.NOT_FOUND, 404);
  }

  await context.repositories.get(DiscoverSeenRepository).dismiss(context.requireUser().id, itemId);

  await updateDiscoverLive(context, (content) => {
    if (!content.items.some((item) => item.id === itemId)) {
      throw new AssistantError("Discover item not found", ErrorType.NOT_FOUND, 404);
    }

    return {
      ...content,
      items: content.items.map((item) => {
        if (item.id !== itemId || item.dismissed) {
          return item;
        }

        updated = 1;

        return { ...item, dismissed: true };
      }),
    };
  });

  return { updated };
}
