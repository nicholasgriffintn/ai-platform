import type { DiscoverWindDownTonight } from "@ngriffin_uk/polychat-schemas";
import { describeZonedInstant } from "@ngriffin_uk/polychat-utility-core";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import {
  chooseStoryTopic,
  pickWindDownTonight,
  type WindDownDay,
} from "~/modules/discover/domain/wind-down";
import { loadPolyAgenda } from "~/modules/poly/application/read-agenda";

import { listRecentDiscoverChatTitles } from "./context";
import { listRecentDiscoverEditions } from "./editions";
import { listDiscoverFollows } from "./follows";
import { readDiscoverHealthSummary } from "./health";
import { listDiscoverDocuments } from "./notebook";
import { readDiscoverRoutine } from "./settings";
import { listRecentWindDowns } from "./wind-down-history";

const DAY_CHAT_LIMIT = 6;
const DAY_WAITING_LIMIT = 5;
const HIGHLIGHT_SIGNAL_ID = "readwise-highlights";

export async function readWindDownHighlights(
  context: ServiceContext,
  userId: number,
): Promise<string[]> {
  const documents = await listDiscoverDocuments(context, userId);

  return documents.signals
    .filter((document) => document.signalId === HIGHLIGHT_SIGNAL_ID)
    .flatMap((document) => document.lines);
}

async function readZonedNow(context: ServiceContext, now: Date) {
  const settings = await readDiscoverRoutine(context);

  return describeZonedInstant(now, settings.timezone ?? "UTC");
}

export async function readWindDownDay(
  context: ServiceContext,
  userId: number,
  now = new Date(),
): Promise<WindDownDay> {
  const zoned = await readZonedNow(context, now);
  const [chats, agenda, editions, health] = await Promise.all([
    listRecentDiscoverChatTitles(context, userId, now.getTime(), 1),
    loadPolyAgenda(context.repositories, userId),
    listRecentDiscoverEditions(context, userId, 2),
    readDiscoverHealthSummary(context, userId, zoned.date),
  ]);

  return {
    chats: chats.slice(0, DAY_CHAT_LIMIT),
    waiting: agenda.needs_you.slice(0, DAY_WAITING_LIMIT).map((item) => item.title),
    calendar: editions
      .filter((edition) => edition.content.date === zoned.date)
      .flatMap((edition) => edition.content.brief)
      .filter((line) => line.kind === "calendar")
      .map((line) => `${line.label}: ${line.text}`),
    sleepMinutes: health?.sleepMinutes ?? null,
  };
}

export async function readWindDownTonight(
  context: ServiceContext,
  now = new Date(),
): Promise<DiscoverWindDownTonight> {
  const user = context.requireUser();
  const zoned = await readZonedNow(context, now);
  const [recent, follows, health, agenda, highlights] = await Promise.all([
    listRecentWindDowns(context, user.id),
    listDiscoverFollows(context, user.id),
    readDiscoverHealthSummary(context, user.id, zoned.date),
    loadPolyAgenda(context.repositories, user.id),
    readWindDownHighlights(context, user.id),
  ]);
  const pick = pickWindDownTonight({
    hour: Number.parseInt(zoned.time.slice(0, 2), 10),
    sleepMinutes: health?.sleepMinutes ?? null,
    openItems: agenda.needs_you.length,
    storyTopic: chooseStoryTopic(
      follows.map((follow) => follow.topic),
      recent,
    ),
    readBack: highlights.length > 0,
    recent,
  });

  return { ...pick, readBack: highlights.length > 0 };
}
