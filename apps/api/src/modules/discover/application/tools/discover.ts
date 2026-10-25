import {
  DISCOVER_COMPOSE_TOOL_NAME,
  DISCOVER_CONTEXT_TOOL_NAME,
  WIND_DOWN_TOOL_NAME,
  type ComposeDiscoverEditionInput,
  type CreateDiscoverWindDown,
} from "@ngriffin_uk/polychat-schemas";
import { generateId, shiftCalendarDate } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { attachDiscoverArticles } from "~/modules/discover/domain/articles";
import { describeDiscoverContext } from "~/modules/discover/domain/context";
import { readDeviceActivitySource } from "~/modules/discover/domain/device-activity";
import { buildDiscoverEdition } from "~/modules/discover/domain/edition";
import { buildDiscoverFeedGroups } from "~/modules/discover/domain/feed";
import {
  DISCOVER_HEADLINES_TOPIC,
  latestResearchSection,
} from "~/modules/discover/domain/research";
import { isSundayEdition } from "~/modules/discover/domain/week";
import type { IFunctionResponse } from "~/types";
import type { ApiToolDefinition } from "~/types/functions";

import { listDiscoverArticleSources } from "../articles";
import { buildDiscoverContextSnapshot, readDiscoverEditionBasis } from "../context";
import { canAffordDiscoverListen } from "../cost";
import { saveDiscoverEdition } from "../editions";
import { scheduleNextDiscoverGather } from "../gather";
import { enqueueDiscoverJob } from "../jobs";
import { listDiscoverDocuments } from "../notebook";
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
    const [basis, documents, articleSources] = await Promise.all([
      readDiscoverEditionBasis(context),
      listDiscoverDocuments(context, user.id),
      listDiscoverArticleSources(context),
    ]);
    const readable = documents.signals.filter((document) => !document.error);
    const browsed = readable.filter(
      (document) => readDeviceActivitySource(document.providerId) !== null,
    );
    const shared = readable.filter(
      (document) => readDeviceActivitySource(document.providerId) === null,
    );
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
        research: documents.research.flatMap((document) => {
          const section = latestResearchSection(document.content);

          return section && section.date >= shiftCalendarDate(basis.date, -1)
            ? [{ topic: document.topic, results: section.results }]
            : [];
        }),
        signals: shared.map((document) => ({ title: document.title, items: document.items })),
        headlinesTopic: DISCOVER_HEADLINES_TOPIC,
        followedTopics: basis.followedTopics,
        curate: basis.curate,
        interestOrder: args.interests.map((interest) => interest.topic),
      }),
      createId: generateId,
    });
    const editionTime = basis.edition;
    const saved = await saveDiscoverEdition(context, user.id, {
      ...edition,
      cards: attachDiscoverArticles(edition.cards, articleSources),
      edition: editionTime,
      runId: context.executionRunId,
      signals: {
        read: [
          ...new Set(
            documents.signals
              .filter((document) => document.readAt && !document.error)
              .map((document) => document.providerId),
          ),
        ],
        stale: [
          ...new Set(
            documents.signals
              .filter((document) => document.error)
              .map((document) => document.providerId),
          ),
        ],
      },
    });

    await scheduleNextDiscoverGather(context, edition.date, edition.timezone);

    if (edition.cards.some((card) => card.kind === "topic")) {
      await enqueueDiscoverJob(context, { job: "covers", editionId: saved.id });
    }

    const morning = editionTime === "morning";

    if (
      morning &&
      basis.activeReader &&
      basis.preferences.listen &&
      (await canAffordDiscoverListen(context, basis.installationId))
    ) {
      await enqueueDiscoverJob(context, { job: "listen", editionId: saved.id });
    }

    if (morning && basis.watchedLatestEpisode && basis.preferences.episode !== "off") {
      await enqueueDiscoverJob(context, { job: "episode", editionId: saved.id });
    }

    if (basis.follows.length > 0 && edition.cards.some((card) => card.kind === "read")) {
      await enqueueDiscoverJob(context, { job: "links", editionId: saved.id });
    }

    if (morning && basis.preferences.listen && isSundayEdition(edition.date)) {
      await enqueueDiscoverJob(context, { job: "your_week", editionId: saved.id });
    }

    await enqueueDiscoverJob(context, { job: "tidy", today: edition.date });

    const dropped = args.cards.length - edition.cards.length;

    return {
      status: "success",
      name: DISCOVER_COMPOSE_TOOL_NAME,
      content: `Saved the Discover edition for ${edition.date} with ${edition.cards.length} cards${
        dropped > 0 ? `, leaving out ${dropped} on hidden topics or already shown` : ""
      }.`,
      data: { editionId: saved.id, date: edition.date, cards: edition.cards.length },
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
