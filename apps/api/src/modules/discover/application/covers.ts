import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import {
  DISCOVER_JOB_TASK_TYPE,
  type DiscoverCard,
  type DiscoverEditionContent,
  type DiscoverJobTaskData,
} from "@ngriffin_uk/polychat-schemas";
import { isoWeekKey, slugify } from "@ngriffin_uk/polychat-utility-core";
import { mapWithConcurrency } from "@ngriffin_uk/polychat-utility-server/async";
import {
  AssistantError,
  ErrorType,
  getErrorMessage,
} from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { StorageService } from "~/infrastructure/storage";
import { getPrivateFileResponse } from "~/infrastructure/storage/read-resource";
import { generateStudioImage } from "~/modules/notebooks/application/studio/images";
import { OutputRepository } from "~/modules/outputs/infrastructure/OutputRepository";
import { TaskService } from "~/modules/queue/application/TaskService";
import { TaskRepository } from "~/modules/queue/infrastructure/TaskRepository";

import { requireDiscoverEdition } from "./editions";
import { publishDiscoverChanged } from "./events";

const logger = getLogger({ prefix: "discover/covers" });
const COVER_CONCURRENCY = 2;
const COVER_WIDTH = 768;
const COVER_HEIGHT = 960;
const COVER_STYLE =
  "Painterly editorial illustration with rich colour, visible brushwork, warm cinematic light and a single clear subject";

function coverKey(userId: number, coverId: string): string {
  return `discover/${userId}/covers/${coverId}`;
}

function coverIdFor(topic: string, date: string): string {
  return `${slugify(topic, 60) || "topic"}-${isoWeekKey(date)}`;
}

export async function enqueueDiscoverJob(
  context: ServiceContext,
  job: DiscoverJobTaskData,
): Promise<void> {
  await new TaskService(context.env, new TaskRepository(context.env)).enqueueTask({
    task_type: DISCOVER_JOB_TASK_TYPE,
    user_id: context.requireUser().id,
    task_data: { ...job, runId: job.runId ?? context.executionRunId },
    priority: 6,
  });
}

async function drawCover(
  context: ServiceContext,
  userId: number,
  card: Extract<DiscoverCard, { kind: "topic" }>,
  coverId: string,
): Promise<boolean> {
  const storage = StorageService.forPrivateAssets(context);
  const key = coverKey(userId, coverId);

  if (await storage.headObject(key)) {
    return true;
  }

  try {
    const image = await generateStudioImage(context, {
      completionId: `discover-cover-${coverId}`,
      prompt: `${COVER_STYLE}. ${card.topic}: ${card.title}. ${card.angle} No text, letters, numbers or logos anywhere in the picture.`,
      aspectRatio: "4:5",
      width: COVER_WIDTH,
      height: COVER_HEIGHT,
    });

    if (!image) {
      return false;
    }

    await storage.uploadObject(key, await image.arrayBuffer(), {
      httpMetadata: { contentType: image.type || "image/png" },
    });

    return true;
  } catch (error) {
    logger.warn("Discover cover failed", { coverId, error_message: getErrorMessage(error) });

    return false;
  }
}

export async function drawDiscoverCovers(context: ServiceContext, editionId: string) {
  const user = context.requireUser();
  const edition = await requireDiscoverEdition(context, user.id, editionId);
  const pending = edition.content.cards.filter(
    (card): card is Extract<DiscoverCard, { kind: "topic" }> =>
      card.kind === "topic" && !card.coverId,
  );
  const drawn = new Map<string, string>();

  await mapWithConcurrency(pending, COVER_CONCURRENCY, async (card) => {
    const coverId = coverIdFor(card.topic, edition.content.date);

    if (await drawCover(context, user.id, card, coverId)) {
      drawn.set(card.id, coverId);
    }
  });

  if (drawn.size === 0) {
    return 0;
  }

  const latest = await requireDiscoverEdition(context, user.id, editionId);
  const content: DiscoverEditionContent = {
    ...latest.content,
    cards: latest.content.cards.map((card) =>
      card.kind === "topic" && drawn.has(card.id) ? { ...card, coverId: drawn.get(card.id) } : card,
    ),
  };

  await context.repositories.get(OutputRepository).updateOutput(editionId, {
    content,
    expectedRevision: latest.revision,
    updatedByUserId: user.id,
  });
  await publishDiscoverChanged(context);

  return drawn.size;
}

export async function readDiscoverCover(
  context: ServiceContext,
  coverId: string,
  rangeHeader?: string | null,
): Promise<Response> {
  const user = context.requireUser();
  const object = await StorageService.forPrivateAssets(context).getObjectBody(
    coverKey(user.id, coverId),
  );

  if (!object) {
    throw new AssistantError("Cover not found", ErrorType.NOT_FOUND, 404);
  }

  return getPrivateFileResponse(
    { mime_type: object.httpMetadata?.contentType ?? "image/png", filename: coverId },
    object,
    rangeHeader,
  );
}
