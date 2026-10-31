import {
  DISCOVER_CAPABILITY_ID,
  DISCOVER_FEEDBACK_KIND,
  discoverFeedbackSignalSchema,
  type DiscoverFeedbackRequest,
  type DiscoverFeedbackResponse,
} from "@ngriffin_uk/polychat-schemas";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import z from "zod/v4";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import {
  ActivityRepository,
  type ActivityRecord,
} from "~/modules/activity/infrastructure/ActivityRepository";
import {
  describeDiscoverCard,
  discoverCardTopic,
  discoverCardUrl,
} from "~/modules/discover/domain/edition";
import { collectCardSignals, type DiscoverFeedbackEntry } from "~/modules/discover/domain/feedback";

import { keepDiscoverPage } from "./articles";
import { requireDiscoverEdition } from "./editions";

const FEEDBACK_SCAN_LIMIT = 300;

const feedbackDataSchema = z.object({
  editionId: z.string().min(1),
  cardId: z.string().min(1),
  signal: discoverFeedbackSignalSchema,
  topic: z.string().nullable(),
  title: z.string(),
  url: z.string().nullable(),
});

function readFeedbackEntry(record: ActivityRecord): DiscoverFeedbackEntry | null {
  if (record.kind !== DISCOVER_FEEDBACK_KIND) {
    return null;
  }

  const parsed = feedbackDataSchema.safeParse(safeParseJson(record.data));

  return parsed.success
    ? {
        ...parsed.data,
        topic: parsed.data.topic ?? null,
        url: parsed.data.url ?? null,
        createdAt: record.created_at,
      }
    : null;
}

export async function listDiscoverFeedback(
  context: ServiceContext,
  userId: number,
): Promise<DiscoverFeedbackEntry[]> {
  const records = await context.repositories
    .get(ActivityRepository)
    .listPersonalActivities(userId, {
      capabilityId: DISCOVER_CAPABILITY_ID,
      limit: FEEDBACK_SCAN_LIMIT,
    });

  return records.flatMap((record) => {
    const entry = readFeedbackEntry(record);

    return entry ? [entry] : [];
  });
}

export async function recordDiscoverFeedback(
  context: ServiceContext,
  input: DiscoverFeedbackRequest,
): Promise<DiscoverFeedbackResponse> {
  const user = context.requireUser();
  const edition = await requireDiscoverEdition(context, user.id, input.editionId);
  const card = edition.content.cards.find((candidate) => candidate.id === input.cardId);

  if (!card) {
    throw new AssistantError("That card is not in this edition", ErrorType.NOT_FOUND, 404);
  }

  const title = describeDiscoverCard(card);
  const url = discoverCardUrl(card);

  await context.repositories.get(ActivityRepository).createActivity({
    createdByUserId: user.id,
    capabilityId: DISCOVER_CAPABILITY_ID,
    groupId: `${input.editionId}:${input.cardId}`,
    kind: DISCOVER_FEEDBACK_KIND,
    status: "succeeded",
    summary: `${input.signal}: ${title}`.slice(0, 200),
    data: {
      editionId: input.editionId,
      cardId: input.cardId,
      signal: input.signal,
      topic: discoverCardTopic(card),
      title,
      url,
    },
  });

  const keepPage = url && (input.signal === "saved" || input.signal === "opened");
  const [feedback] = await Promise.all([
    listDiscoverFeedback(context, user.id),
    keepPage ? keepDiscoverPage(context, url) : undefined,
  ]);
  const signals = collectCardSignals(feedback, edition.id);

  return { cardId: input.cardId, signals: signals[input.cardId] ?? [] };
}
