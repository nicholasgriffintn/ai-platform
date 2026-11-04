import { renderPrompt } from "@ngriffin_uk/polychat-ai-prompts";
import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import {
  DISCOVER_INTERESTS_METADATA_KEY,
  discoverInterestInferenceSchema,
  discoverInterestProfileSchema,
  type DiscoverInterestInference,
  type DiscoverInterestProfile,
} from "@ngriffin_uk/polychat-schemas";
import { DAY_MS, describeZonedInstant, sha256Hex } from "@ngriffin_uk/polychat-utility-core";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-server/errors";
import { parseJsonRecord } from "@ngriffin_uk/polychat-utility-server/json";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { discoverTopicKey } from "~/modules/discover/domain/edition";
import { summariseDiscoverFeedPreferences } from "~/modules/discover/domain/feed-weights";
import {
  keepDiscoverFeedbackSince,
  listOpenedDiscoverTitles,
  summariseDiscoverFeedback,
} from "~/modules/discover/domain/feedback";
import { isDiscoverSignalCurrent } from "~/modules/discover/domain/freshness";
import {
  chooseResearchTopics,
  describeInterestMaterial,
  INTEREST_OPENED_DAYS,
  mergeInterestProfile,
  renderInterestProfile,
} from "~/modules/discover/domain/interests";
import { showsDiscoverActivity } from "~/modules/discover/domain/signal-catalogue";
import { condenseSignalLines } from "~/modules/discover/domain/signal-document";
import { generateSystemObject } from "~/modules/models/application/system-object";
import {
  SourceRepository,
  type SourceRecord,
} from "~/modules/sources/infrastructure/SourceRepository";

import { listRecentDiscoverChatTitles, readMemorySummary } from "./context";
import { readDiscoverDayProfile } from "./day-profile";
import { listDiscoverFeedback } from "./feedback";
import { listDiscoverFollows } from "./follows";
import { listDiscoverDocumentSources, readDiscoverDocuments } from "./notebook";
import { writeDiscoverDocument } from "./signal-documents";

const logger = getLogger({ prefix: "discover/interests" });
const OPENED_TITLE_LIMIT = 20;

export interface DiscoverInterestChoice {
  interests: DiscoverInterestProfile["interests"];
  more: string[];
  saved: string[];
  hidden: string[];
  engaged: ReadonlyMap<string, number>;
}

async function interestProfileId(userId: number): Promise<string> {
  return `discover_interests_${(await sha256Hex(`${userId}:interests`)).slice(0, 24)}`;
}

export async function readDiscoverInterestProfile(
  context: ServiceContext,
  userId: number,
): Promise<DiscoverInterestProfile | null> {
  const source = await context.repositories
    .get(SourceRepository)
    .getSource(await interestProfileId(userId));

  if (!source || source.created_by_user_id !== userId) {
    return null;
  }

  const profile = discoverInterestProfileSchema.safeParse(
    parseJsonRecord(source.metadata)[DISCOVER_INTERESTS_METADATA_KEY],
  );

  return profile.success ? profile.data : null;
}

async function inferInterests(
  context: ServiceContext,
  notebookId: string,
  input: {
    now: Date;
    profile: DiscoverInterestProfile | null;
    opened: readonly string[];
    more: readonly string[];
    hidden: readonly string[];
  },
): Promise<DiscoverInterestInference["interests"] | null> {
  const user = context.requireUser();
  const [sources, chatTitles, memorySummary] = await Promise.all([
    listDiscoverDocumentSources(context, notebookId),
    listRecentDiscoverChatTitles(context, user.id, input.now.getTime()),
    readMemorySummary(context, user.id),
  ]);
  const signals = readDiscoverDocuments(sources)
    .signals.filter(
      (document) =>
        !document.error &&
        showsDiscoverActivity(document.signalId) &&
        document.lines.length > 0 &&
        isDiscoverSignalCurrent(document.readAt, input.now.getTime()),
    )
    .map((document) => ({ title: document.title, lines: condenseSignalLines(document.lines) }));

  try {
    const { interests } = await generateSystemObject(context, {
      role: "writing",
      name: "discover_interests",
      requiresReasoning: false,
      schema: discoverInterestInferenceSchema,
      system: renderPrompt("discover/interests"),
      material: describeInterestMaterial({
        signals,
        chatTitles,
        memorySummary,
        opened: input.opened,
        more: input.more,
        less: input.hidden,
        profile: input.profile,
      }),
    });

    return interests;
  } catch (error) {
    logger.warn("Discover interests could not be inferred", {
      error_message: getErrorMessage(error),
    });

    return null;
  }
}

export async function chooseDiscoverInterests(
  context: ServiceContext,
  notebookId: string,
  input: { today: string; now: Date; refresh: boolean },
): Promise<DiscoverInterestChoice> {
  const user = context.requireUser();
  const [profile, feedback, dayProfile] = await Promise.all([
    readDiscoverInterestProfile(context, user.id),
    listDiscoverFeedback(context, user.id),
    readDiscoverDayProfile(context),
  ]);
  const summary = summariseDiscoverFeedback(feedback);
  const hidden = [...summary.hiddenTopics, ...summary.lessTopics, ...dayProfile.mutedTopics];
  const recent = keepDiscoverFeedbackSince(
    feedback,
    input.now.getTime() - INTEREST_OPENED_DAYS * DAY_MS,
  );
  const kept = {
    interests: profile?.interests ?? [],
    more: summary.moreTopics,
    saved: summary.savedTopics,
    hidden,
    engaged: summariseDiscoverFeedPreferences(recent).engaged,
  };

  if (!input.refresh || profile?.updatedOn === input.today) {
    return kept;
  }

  const found = await inferInterests(context, notebookId, {
    now: input.now,
    profile,
    opened: listOpenedDiscoverTitles(recent, OPENED_TITLE_LIMIT),
    more: summary.moreTopics,
    hidden,
  });

  if (!found) {
    return kept;
  }

  const next = mergeInterestProfile(profile, found, { today: input.today, hidden });

  await writeDiscoverDocument(context, notebookId, {
    id: await interestProfileId(user.id),
    origin: "generated",
    kind: "text",
    title: "Interests",
    provider: "discover",
    content: renderInterestProfile(next),
    metadata: { [DISCOVER_INTERESTS_METADATA_KEY]: next },
  });

  return { ...kept, interests: next.interests };
}

function readResearchDates(
  sources: readonly SourceRecord[],
  timezone: string,
): Map<string, string> {
  const dates = new Map<string, string>();

  for (const document of readDiscoverDocuments(sources).research) {
    if (document.attemptedAt) {
      dates.set(
        discoverTopicKey(document.topic),
        describeZonedInstant(new Date(document.attemptedAt), timezone).date,
      );
    }
  }

  return dates;
}

export async function chooseDiscoverResearchTopics(
  context: ServiceContext,
  notebookId: string,
  input: { asked: readonly string[]; today: string; now: Date; timezone: string; refresh: boolean },
): Promise<string[]> {
  const user = context.requireUser();
  const [follows, interests, sources, dayProfile] = await Promise.all([
    listDiscoverFollows(context, user.id),
    chooseDiscoverInterests(context, notebookId, {
      today: input.today,
      now: input.now,
      refresh: input.refresh,
    }),
    listDiscoverDocumentSources(context, notebookId),
    readDiscoverDayProfile(context),
  ]);

  return chooseResearchTopics({
    followed: [...dayProfile.topics, ...follows.map((follow) => follow.topic)],
    asked: input.asked,
    more: interests.more,
    saved: interests.saved,
    inferred: interests.interests,
    engaged: interests.engaged,
    researchedOn: readResearchDates(sources, input.timezone),
    hidden: interests.hidden,
    today: input.today,
  });
}
