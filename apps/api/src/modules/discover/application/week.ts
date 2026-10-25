import {
  DISCOVER_CAPABILITY_ID,
  DISCOVER_EPISODES_CAPABILITY_ID,
} from "@ngriffin_uk/polychat-schemas";
import { humaniseIdentifier, parseTimestamp } from "@ngriffin_uk/polychat-utility-core";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { ConversationRepository } from "~/modules/conversations/infrastructure/ConversationRepository";
import {
  buildWeekMaterial,
  YOUR_WEEK_FOCUS,
  YOUR_WEEK_TITLE,
} from "~/modules/discover/domain/week";
import { NotebookRepository } from "~/modules/notebooks/infrastructure/NotebookRepository";
import { OutputRepository } from "~/modules/outputs/infrastructure/OutputRepository";
import { ensureFolder } from "~/modules/sources/application/folders";
import { startPodcastGeneration } from "~/modules/sources/application/podcasts/generate";
import { SourceRepository } from "~/modules/sources/infrastructure/SourceRepository";

import { enqueueDiscoverJob } from "./covers";
import { requireDiscoverEdition, withEditionRun } from "./editions";
import { publishDiscoverChanged } from "./events";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const OUTPUT_SCAN_LIMIT = 100;
const CHAT_SCAN_LIMIT = 40;
const HIDDEN_CAPABILITIES = new Set([DISCOVER_CAPABILITY_ID, DISCOVER_EPISODES_CAPABILITY_ID]);

async function gatherWeek(context: ServiceContext, userId: number, sinceMs: number) {
  const since = new Date(sinceMs).toISOString();
  const isRecent = (timestamp: string) => parseTimestamp(timestamp).getTime() >= sinceMs;

  const [outputs, notebooks, chats] = await Promise.all([
    context.repositories
      .get(OutputRepository)
      .listPersonalOutputs(userId, undefined, { limit: OUTPUT_SCAN_LIMIT }),
    context.repositories.get(NotebookRepository).listPersonalNotebooks(userId),
    context.repositories.get(ConversationRepository).listUserConversations(userId, {
      updatedAfter: since,
      limit: CHAT_SCAN_LIMIT,
      teammateThreads: "exclude",
    }),
  ]);

  return buildWeekMaterial({
    made: outputs
      .filter(
        (output) =>
          isRecent(output.created_at) && !HIDDEN_CAPABILITIES.has(output.capability_id ?? ""),
      )
      .map((output) => `${output.title} (${humaniseIdentifier(output.kind)})`),
    notebooks: notebooks
      .filter((notebook) => isRecent(notebook.updated_at ?? notebook.created_at))
      .map((notebook) => notebook.title),
    chats: chats.data.flatMap((row) =>
      typeof row.title === "string" && row.title ? [row.title] : [],
    ),
  });
}

export async function queueYourWeek(
  context: ServiceContext,
  editionId: string,
): Promise<{ queued: true }> {
  const edition = await requireDiscoverEdition(context, context.requireUser().id, editionId);

  await enqueueDiscoverJob(withEditionRun(context, edition), { job: "your_week", editionId });

  return { queued: true };
}

export async function produceYourWeek(
  context: ServiceContext,
  editionId: string,
  now = Date.now(),
): Promise<string | null> {
  const user = context.requireUser();
  const edition = await requireDiscoverEdition(context, user.id, editionId);

  if (edition.content.weekSourceId) {
    const current = await context.repositories
      .get(SourceRepository)
      .getSource(edition.content.weekSourceId);

    if (current && current.status !== "failed") {
      return current.id;
    }
  }

  const material = await gatherWeek(context, user.id, now - WEEK_MS);

  if (!material) {
    return null;
  }

  const { id: showId } = await ensureFolder(context, user.id, {
    projectId: null,
    title: YOUR_WEEK_TITLE,
    kind: "podcast",
  });
  const episode = await startPodcastGeneration(context, {
    sourceIds: [],
    material,
    title: `${YOUR_WEEK_TITLE}, ${edition.content.date}`,
    focus: YOUR_WEEK_FOCUS,
    format: "brief",
    length: "short",
    language: "en",
    showId,
  });
  const latest = await requireDiscoverEdition(context, user.id, editionId);

  await context.repositories.get(OutputRepository).updateOutput(editionId, {
    content: { ...latest.content, weekSourceId: episode.id },
    expectedRevision: latest.revision,
    updatedByUserId: user.id,
  });
  await publishDiscoverChanged(context);

  return episode.id;
}
