import type { DiscoverFollow, DiscoverSettings } from "@ngriffin_uk/polychat-schemas";
import { describeZonedInstant, partOfDay, truncateText } from "@ngriffin_uk/polychat-utility-core";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { getUserSettings } from "~/modules/auth/application/user";
import { ConversationRepository } from "~/modules/conversations/infrastructure/ConversationRepository";
import type {
  DiscoverContextSnapshot,
  DiscoverResearchContext,
  DiscoverSignalContext,
} from "~/modules/discover/domain/context";
import {
  describeDiscoverCard,
  discoverTopicKey,
  listEditionUrls,
} from "~/modules/discover/domain/edition";
import { summariseDiscoverFeedback } from "~/modules/discover/domain/feedback";
import { isActiveDiscoverReader } from "~/modules/discover/domain/listen";
import { latestResearchSection } from "~/modules/discover/domain/research";
import {
  findDiscoverPublicFeed,
  findDiscoverSignal,
} from "~/modules/discover/domain/signal-catalogue";
import { selectRecentChatTitles } from "~/modules/discover/domain/signals";
import { MemorySynthesisRepository } from "~/modules/memory/infrastructure/MemorySynthesisRepository";
import { loadPolyAgenda } from "~/modules/poly/application/read-agenda";

import { listRecentDiscoverEditions } from "./editions";
import { wasLatestEpisodeWatched } from "./episodes";
import { listDiscoverFeedback } from "./feedback";
import { listDiscoverFollows } from "./follows";
import { ensureDiscoverGathered } from "./gather";
import { readDiscoverHealthSummary } from "./health";
import type { DiscoverDocuments } from "./notebook";
import { loadResurfaceCandidates } from "./resurface";
import { readDiscoverRoutine } from "./settings";

const RECENT_EDITION_COUNT = 7;
const CHAT_SCAN_LIMIT = 80;
const CHAT_TITLE_LIMIT = 40;
const CHAT_MAX_AGE_DAYS = 30;
const MEMORY_SUMMARY_LIMIT = 2_000;
const WAITING_LIMIT = 3;

function stringField(row: Record<string, unknown>, key: string): string {
  const value = row[key];

  return typeof value === "string" ? value : "";
}

export async function readMemorySummary(
  context: ServiceContext,
  userId: number,
): Promise<string | null> {
  const settings = await getUserSettings(context.repositories, userId);

  if (!settings?.memories_save_enabled && !settings?.memories_chat_history_enabled) {
    return null;
  }

  const synthesis = await context.repositories
    .get(MemorySynthesisRepository)
    .getActiveSynthesis(userId);

  return synthesis?.synthesis_text
    ? truncateText(synthesis.synthesis_text, MEMORY_SUMMARY_LIMIT)
    : null;
}

export async function listRecentDiscoverChatTitles(
  context: ServiceContext,
  userId: number,
  now: number,
): Promise<string[]> {
  const conversations = await context.repositories
    .get(ConversationRepository)
    .listUserConversations(userId, { limit: CHAT_SCAN_LIMIT, teammateThreads: "exclude" });

  return selectRecentChatTitles(
    conversations.data.map((row) => ({
      title: stringField(row, "title"),
      type: stringField(row, "type"),
      updatedAt: stringField(row, "updated_at") || stringField(row, "created_at"),
    })),
    { now, maxAgeDays: CHAT_MAX_AGE_DAYS, limit: CHAT_TITLE_LIMIT },
  );
}

export interface DiscoverEditionBasis {
  follows: DiscoverFollow[];
  activeReader: boolean;
  watchedLatestEpisode: boolean;
  installationId: string | null;
  preferences: Pick<DiscoverSettings, "listen" | "episode">;
  date: string;
  timezone: string;
  hiddenTopics: Set<string>;
  followedTopics: Set<string>;
  curate: string;
  resurfaceHrefs: Set<string>;
  recentUrls: Set<string>;
}

async function loadDiscoverBasis(context: ServiceContext, now: Date) {
  const user = context.requireUser();
  const settings = await readDiscoverRoutine(context);
  const timezone = settings.timezone ?? "UTC";
  const zoned = describeZonedInstant(now, timezone);
  const [feedback, editions, follows] = await Promise.all([
    listDiscoverFeedback(context, user.id),
    listRecentDiscoverEditions(context, user.id, RECENT_EDITION_COUNT),
    listDiscoverFollows(context, user.id),
  ]);
  const recentEditions = editions
    .filter((edition) => edition.content.date !== zoned.date)
    .map((edition) => edition.content);

  return {
    user,
    settings,
    timezone,
    zoned,
    feedback: summariseDiscoverFeedback(feedback),
    feedbackEntries: feedback,
    recentEditions,
    follows,
  };
}

export async function readDiscoverEditionBasis(
  context: ServiceContext,
  now = new Date(),
): Promise<DiscoverEditionBasis> {
  const basis = await loadDiscoverBasis(context, now);
  const [watchedLatestEpisode, resurface] = await Promise.all([
    wasLatestEpisodeWatched(context, basis.user.id),
    loadResurfaceCandidates(context, {
      userId: basis.user.id,
      follows: basis.follows,
      feedback: basis.feedbackEntries,
      today: basis.zoned.date,
      now: now.getTime(),
    }),
  ]);

  return {
    follows: basis.follows,
    watchedLatestEpisode,
    installationId: basis.settings.installationId,
    preferences: { listen: basis.settings.listen, episode: basis.settings.episode },
    activeReader: isActiveDiscoverReader(
      basis.feedbackEntries,
      basis.recentEditions.length > 0,
      now.getTime(),
    ),
    date: basis.zoned.date,
    timezone: basis.timezone,
    hiddenTopics: new Set(basis.feedback.hiddenTopics.map(discoverTopicKey)),
    followedTopics: new Set(basis.follows.map((follow) => discoverTopicKey(follow.topic))),
    curate: basis.settings.curate,
    resurfaceHrefs: new Set(resurface.map((item) => item.href)),
    recentUrls: listEditionUrls(basis.recentEditions),
  };
}

function describeDocuments(documents: DiscoverDocuments): {
  signals: DiscoverSignalContext[];
  research: DiscoverResearchContext[];
} {
  return {
    signals: documents.signals.map((document) => ({
      title: document.title,
      group:
        findDiscoverSignal(document.signalId)?.group ??
        findDiscoverPublicFeed(document.signalId)?.group ??
        "signal",
      readAt: document.readAt,
      error: document.error,
      lines: document.lines,
    })),
    research: documents.research.flatMap((document) => {
      const section = latestResearchSection(document.content);

      return section
        ? [{ topic: document.topic, date: section.date, results: section.results }]
        : [];
    }),
  };
}

export async function buildDiscoverContextSnapshot(
  context: ServiceContext,
  now = new Date(),
): Promise<DiscoverContextSnapshot> {
  const basis = await loadDiscoverBasis(context, now);
  const userId = basis.user.id;
  const documents = describeDocuments(await ensureDiscoverGathered(context, now));
  const [conversations, memorySummary, agenda, resurface, health] = await Promise.all([
    context.repositories
      .get(ConversationRepository)
      .listUserConversations(userId, { limit: CHAT_SCAN_LIMIT, teammateThreads: "exclude" }),
    readMemorySummary(context, userId),
    loadPolyAgenda(context.repositories, userId),
    loadResurfaceCandidates(context, {
      userId,
      follows: basis.follows,
      feedback: basis.feedbackEntries,
      today: basis.zoned.date,
      now: now.getTime(),
    }),
    readDiscoverHealthSummary(context, userId, basis.zoned.date),
  ]);

  return {
    date: basis.zoned.date,
    weekday: basis.zoned.weekday,
    partOfDay: partOfDay(Number.parseInt(basis.zoned.time.slice(0, 2), 10)),
    timezone: basis.timezone,
    curate: basis.settings.curate,
    followedTopics: basis.follows.map((follow) => follow.topic),
    chatTitles: selectRecentChatTitles(
      conversations.data.map((row) => ({
        title: stringField(row, "title"),
        type: stringField(row, "type"),
        updatedAt: stringField(row, "updated_at") || stringField(row, "created_at"),
      })),
      { now: now.getTime(), maxAgeDays: CHAT_MAX_AGE_DAYS, limit: CHAT_TITLE_LIMIT },
    ),
    memorySummary,
    feedback: basis.feedback,
    recentCardTitles: basis.recentEditions.flatMap((edition) =>
      edition.cards.map(describeDiscoverCard),
    ),
    waitingOnYou: agenda.needs_you.slice(0, WAITING_LIMIT).map((item) => ({
      title: item.title,
      href: `/chat/${encodeURIComponent(item.conversation_id)}`,
    })),
    resurface,
    health,
    signals: documents.signals,
    research: documents.research,
  };
}
