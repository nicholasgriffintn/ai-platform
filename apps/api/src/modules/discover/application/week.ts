import { getMessageTextContent } from "@ngriffin_uk/polychat-library-chat/messages";
import {
  DISCOVER_CAPABILITY_ID,
  DISCOVER_EPISODES_CAPABILITY_ID,
} from "@ngriffin_uk/polychat-schemas";
import {
  collectStrings,
  humaniseIdentifier,
  parseTimestamp,
  truncateSingleLine,
} from "@ngriffin_uk/polychat-utility-core";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { ConversationRepository } from "~/modules/conversations/infrastructure/ConversationRepository";
import { MessageRepository } from "~/modules/conversations/infrastructure/MessageRepository";
import {
  buildWeekMaterial,
  type WeekChatItem,
  YOUR_WEEK_FOCUS,
  YOUR_WEEK_TITLE,
} from "~/modules/discover/domain/week";
import { readNotebookGuide } from "~/modules/notebooks/domain/notebook";
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

const CHAT_DETAIL_LIMIT = 15;
const CHAT_MESSAGE_SCAN = 40;
const OUTPUT_EXCERPT_CHARACTERS = 500;
const CHAT_ASK_CHARACTERS = 200;
const CHAT_ANSWER_CHARACTERS = 500;

function messageText(row: Record<string, unknown>): string {
  const content = row.content;
  const parts = row.parts;

  return getMessageTextContent({
    content: typeof content === "string" ? content : (safeParseJson(String(content ?? "")) ?? ""),
    parts: Array.isArray(parts) ? parts : (safeParseJson(String(parts ?? "")) ?? undefined),
  } as Parameters<typeof getMessageTextContent>[0]);
}

async function describeChat(
  context: ServiceContext,
  row: Record<string, unknown>,
): Promise<WeekChatItem | null> {
  const id = typeof row.id === "string" ? row.id : "";
  const title = typeof row.title === "string" ? row.title.trim() : "";

  if (!id || !title) {
    return null;
  }

  const messages = await context.repositories
    .get(MessageRepository)
    .getMessages(id, CHAT_MESSAGE_SCAN);
  const lastOf = (role: string) =>
    [...messages].reverse().find((message) => message.role === role && messageText(message));

  return {
    title,
    asked: truncateSingleLine(messageText(lastOf("user") ?? {}), CHAT_ASK_CHARACTERS),
    answered: truncateSingleLine(messageText(lastOf("assistant") ?? {}), CHAT_ANSWER_CHARACTERS),
  };
}

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
  const described = await Promise.all(
    chats.data.slice(0, CHAT_DETAIL_LIMIT).map((row) => describeChat(context, row)),
  );

  return buildWeekMaterial({
    made: outputs
      .filter(
        (output) =>
          isRecent(output.created_at) && !HIDDEN_CAPABILITIES.has(output.capability_id ?? ""),
      )
      .map((output) => ({
        title: output.title,
        kind: humaniseIdentifier(output.kind),
        excerpt: collectStrings(safeParseJson(output.content), OUTPUT_EXCERPT_CHARACTERS),
      }))
      .filter((item) => item.excerpt.length > 0),
    notebooks: notebooks
      .filter((notebook) => isRecent(notebook.updated_at ?? notebook.created_at))
      .map((notebook) => ({
        title: notebook.title,
        about: truncateSingleLine(
          readNotebookGuide(notebook.guide)?.summary.replace(/\*\*/gu, "") ??
            notebook.instructions ??
            "",
          OUTPUT_EXCERPT_CHARACTERS,
        ),
      })),
    chats: described.filter((chat): chat is WeekChatItem => chat !== null),
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
