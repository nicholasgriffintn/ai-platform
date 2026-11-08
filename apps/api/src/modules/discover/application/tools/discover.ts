import {
  DISCOVER_COMPOSE_TOOL_NAME,
  DISCOVER_CONTEXT_TOOL_NAME,
  WIND_DOWN_TOOL_NAME,
  type ComposeDiscoverEditionInput,
  type CreateDiscoverWindDown,
} from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { attachDiscoverArticles } from "~/modules/discover/domain/articles";
import { describeDiscoverContext } from "~/modules/discover/domain/context";
import { buildDiscoverEdition } from "~/modules/discover/domain/edition";
import { buildDiscoverFeedGroups, splitDiscoverSignalFeeds } from "~/modules/discover/domain/feed";
import {
  DISCOVER_HEADLINES_TOPIC,
  selectCurrentResearch,
} from "~/modules/discover/domain/research";
import { keepUsedDiscoverDocuments } from "~/modules/discover/domain/signal-selection";
import { foldDiscoverStoryCards } from "~/modules/discover/domain/story-cards";
import { isSundayEdition } from "~/modules/discover/domain/week";
import { listStoriesByUrl } from "~/modules/stories/application/read-models";
import type { IFunctionResponse } from "~/types";
import type { ApiToolDefinition } from "~/types/functions";

import { listDiscoverArticleSources } from "../articles";
import { buildDiscoverContextSnapshot, readDiscoverEditionBasis } from "../context";
import { queueDiscoverCurrent } from "../current";
import { saveDiscoverEdition } from "../editions";
import { resolveDiscoverSignals } from "../gather";
import { queueDiscoverEditionWork } from "../listen";
import { listDiscoverDocuments } from "../notebook";
import { readDiscoverRoutine } from "../settings";
import { startDiscoverWindDown } from "../wind-down";
import {
  compose_discover_edition as composeDescriptor,
  prepare_wind_down as windDownDescriptor,
  read_discover_context as readDescriptor,
} from "./definitions/discover";

type DiscoverToolContext = Parameters<ApiToolDefinition["execute"]>[1];

function requireToolContext({ request }: DiscoverToolContext) {
  if (!request.context || !request.user?.id) {
    throw new AssistantError(
      "Discover needs a signed-in user",
      ErrorType.AUTHENTICATION_ERROR,
      401,
    );
  }

  return request.context;
}

export const read_discover_context: ApiToolDefinition = {
  ...readDescriptor,
  execute: async (_args: unknown, toolContext) => {
    const context = requireToolContext(toolContext);
    const snapshot = await buildDiscoverContextSnapshot(context);

    return {
      status: "success",
      name: DISCOVER_CONTEXT_TOOL_NAME,
      content: describeDiscoverContext(snapshot),
      data: { date: snapshot.date, timezone: snapshot.timezone },
    } satisfies IFunctionResponse;
  },
};

export const compose_discover_edition: ApiToolDefinition = {
  ...composeDescriptor,
  execute: async (args: ComposeDiscoverEditionInput, toolContext) => {
    const context = requireToolContext(toolContext);
    const user = context.requireUser();
    const [basis, documents, articleSources, routine] = await Promise.all([
      readDiscoverEditionBasis(context),
      listDiscoverDocuments(context, user.id),
      listDiscoverArticleSources(context),
      readDiscoverRoutine(context),
    ]);
    const { selected } = await resolveDiscoverSignals(context, routine);
    const usedSignals = keepUsedDiscoverDocuments(documents.signals, {
      selected,
      excludedProviders: routine.excludedProviders,
    });
    const { browsed, shared } = splitDiscoverSignalFeeds(usedSignals);
    const edition = buildDiscoverEdition({
      draft: args,
      date: basis.date,
      timezone: basis.timezone,
      generatedAt: new Date().toISOString(),
      hiddenTopics: basis.hiddenTopics,
      followedTopics: basis.followedTopics,
      curate: basis.curate,
      resurfaceHrefs: basis.resurfaceHrefs,
      seenLinks: [...basis.seenLinks, ...browsed.flatMap((document) => document.items)],
      feed: buildDiscoverFeedGroups({
        research: selectCurrentResearch(documents.research, {
          today: basis.date,
          hiddenTopics: basis.hiddenTopics,
        }),
        signals: shared.map((document) => ({ title: document.title, items: document.items })),
        headlinesTopic: DISCOVER_HEADLINES_TOPIC,
        followedTopics: basis.followedTopics,
        curate: basis.curate,
        interestOrder: args.interests.map((interest) => interest.topic),
        preferences: basis.feedPreferences,
      }),
      createId: generateId,
    });
    const stories = await listStoriesByUrl(
      context.env,
      edition.cards.flatMap((card) => (card.kind === "read" ? [card.url] : [])),
    );
    const cards = foldDiscoverStoryCards(
      attachDiscoverArticles(edition.cards, articleSources),
      stories,
    );
    const editionTime = basis.edition;
    const saved = await saveDiscoverEdition(context, user.id, {
      ...edition,
      cards,
      edition: editionTime,
      runId: context.executionRunId,
      signals: {
        read: [
          ...new Set(
            usedSignals
              .filter((document) => document.readAt && !document.error)
              .map((document) => document.providerId),
          ),
        ],
        stale: [
          ...new Set(
            usedSignals.filter((document) => document.error).map((document) => document.providerId),
          ),
        ],
      },
    });

    const morning = editionTime === "morning";
    const episode = morning && basis.watchedLatestEpisode && basis.preferences.episode !== "off";

    await queueDiscoverEditionWork(context, saved, {
      covers: cards.some((card) => card.kind === "topic"),
      research: episode ? ["episode"] : [],
      links: basis.follows.length > 0 && cards.some((card) => card.kind === "read"),
      yourWeek: morning && basis.preferences.listen && isSundayEdition(edition.date),
      tidy: edition.date,
    });
    await queueDiscoverCurrent(context);

    const dropped = Math.max(0, args.cards.length - cards.length);

    return {
      status: "success",
      name: DISCOVER_COMPOSE_TOOL_NAME,
      content: `Saved the Discover edition for ${edition.date} with ${cards.length} cards${
        dropped > 0
          ? `, leaving out ${dropped} on hidden topics, already shown or folded into one story`
          : ""
      }.`,
      data: { editionId: saved.id, date: edition.date, cards: cards.length },
    } satisfies IFunctionResponse;
  },
};

export const prepare_wind_down: ApiToolDefinition = {
  ...windDownDescriptor,
  execute: async (args: CreateDiscoverWindDown, toolContext) => {
    const context = requireToolContext(toolContext);
    const session = await startDiscoverWindDown(context, args);

    return {
      status: "success",
      name: WIND_DOWN_TOOL_NAME,
      content: `${session.title} is being recorded in Discover and will be ready to play in about a minute.`,
      data: { windDownId: session.id, kind: session.kind, minutes: session.minutes },
    } satisfies IFunctionResponse;
  },
};
