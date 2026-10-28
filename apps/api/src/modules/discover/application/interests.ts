import { renderPrompt } from "@ngriffin_uk/polychat-ai-prompts";
import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import {
  DISCOVER_INTERESTS_METADATA_KEY,
  discoverInterestInferenceSchema,
  discoverInterestProfileSchema,
  type DiscoverInterestInference,
  type DiscoverInterestProfile,
} from "@ngriffin_uk/polychat-schemas";
import { sha256Hex } from "@ngriffin_uk/polychat-utility-core";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-server/errors";
import { parseJsonRecord } from "@ngriffin_uk/polychat-utility-server/json";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { summariseDiscoverFeedback } from "~/modules/discover/domain/feedback";
import { isDiscoverSignalCurrent } from "~/modules/discover/domain/freshness";
import {
  describeInterestMaterial,
  mergeInterestProfile,
  rankInterestProfile,
  renderInterestProfile,
} from "~/modules/discover/domain/interests";
import { condenseSignalLines } from "~/modules/discover/domain/signal-document";
import { generateSystemObject } from "~/modules/models/application/system-object";
import { SourceRepository } from "~/modules/sources/infrastructure/SourceRepository";

import { listRecentDiscoverChatTitles, readMemorySummary } from "./context";
import { listDiscoverFeedback } from "./feedback";
import { readDiscoverDocuments } from "./notebook";
import { writeDiscoverDocument } from "./signal-documents";

const logger = getLogger({ prefix: "discover/interests" });

export interface DiscoverInterestChoice {
  ranked: string[];
  more: string[];
  hidden: string[];
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
    more: readonly string[];
    hidden: readonly string[];
  },
): Promise<DiscoverInterestInference["interests"] | null> {
  const user = context.requireUser();
  const [sources, chatTitles, memorySummary] = await Promise.all([
    context.repositories.get(SourceRepository).listCollectionSources(notebookId),
    listRecentDiscoverChatTitles(context, user.id, input.now.getTime()),
    readMemorySummary(context, user.id),
  ]);
  const signals = readDiscoverDocuments(sources)
    .signals.filter(
      (document) =>
        !document.error &&
        document.lines.length > 0 &&
        isDiscoverSignalCurrent(document.readAt, input.now.getTime()),
    )
    .map((document) => ({ title: document.title, lines: condenseSignalLines(document.lines) }));

  try {
    const { interests } = await generateSystemObject(context, {
      role: "writing",
      name: "discover_interests",
      schema: discoverInterestInferenceSchema,
      system: renderPrompt("discover/interests"),
      material: describeInterestMaterial({
        signals,
        chatTitles,
        memorySummary,
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
  const [profile, feedback] = await Promise.all([
    readDiscoverInterestProfile(context, user.id),
    listDiscoverFeedback(context, user.id),
  ]);
  const summary = summariseDiscoverFeedback(feedback);
  const hidden = [...summary.hiddenTopics, ...summary.lessTopics];
  const kept = { ranked: rankInterestProfile(profile), more: summary.moreTopics, hidden };

  if (!input.refresh || profile?.updatedOn === input.today) {
    return kept;
  }

  const found = await inferInterests(context, notebookId, {
    now: input.now,
    profile,
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

  return { ...kept, ranked: rankInterestProfile(next) };
}
