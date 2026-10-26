import { extractTextFromMessageContent } from "@ngriffin_uk/polychat-ai-providers";
import {
  workPostAuthorSchema,
  workPostKindSchema,
  type ProjectTask,
  type ProjectTaskThreadPost,
  type WorkPostAuthor,
  type WorkPostKind,
} from "@ngriffin_uk/polychat-schemas";
import { generateId, safeParseJson, truncateText } from "@ngriffin_uk/polychat-utility-core";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { MessageRepository } from "~/modules/conversations/infrastructure/MessageRepository";
import { ProjectTaskRepository } from "~/modules/project-tasks/infrastructure/ProjectTaskRepository";

import { ensureProjectTaskConversation, projectTaskConversationId } from "./runner";

const THREAD_LIMIT = 200;
const THREAD_BODY_LIMIT = 4000;
const RUN_BRIEF_LIMIT = 160;

function isQuestionResponse(data: unknown): boolean {
  const record = typeof data === "string" ? safeParseJson<Record<string, unknown>>(data) : data;

  return Boolean(record && typeof record === "object" && "userQuestionResponse" in record);
}

function readWorkPost(data: unknown): { kind: WorkPostKind; author: WorkPostAuthor } | null {
  const record = typeof data === "string" ? safeParseJson<Record<string, unknown>>(data) : data;

  if (!record || typeof record !== "object" || !("workPost" in record)) {
    return null;
  }

  const post = record.workPost;

  if (!post || typeof post !== "object") {
    return null;
  }

  const kind = workPostKindSchema.safeParse((post as { kind?: unknown }).kind);
  const author = workPostAuthorSchema.safeParse((post as { author?: unknown }).author);

  return kind.success && author.success ? { kind: kind.data, author: author.data } : null;
}

function readMessageText(content: unknown): string {
  if (typeof content === "string" && content.startsWith("[")) {
    return extractTextFromMessageContent(safeParseJson(content) ?? content);
  }

  return extractTextFromMessageContent(content);
}

export async function ensureTaskThread(
  context: ServiceContext,
  task: ProjectTask,
  userId: number,
): Promise<string> {
  const conversationId = task.conversationId ?? projectTaskConversationId(task.id);

  await ensureProjectTaskConversation({ context, task, conversationId, userId });

  if (!task.conversationId) {
    await context.repositories.get(ProjectTaskRepository).updateTask(task.id, { conversationId });
  }

  return conversationId;
}

export async function postToTaskThread(
  context: ServiceContext,
  task: ProjectTask,
  post: { kind: WorkPostKind; author: WorkPostAuthor; body: string },
): Promise<ProjectTaskThreadPost> {
  const user = context.requireUser();
  const conversationId = await ensureTaskThread(context, task, user.id);
  const id = generateId();
  const body = truncateText(post.body.trim(), THREAD_BODY_LIMIT);

  await context.repositories
    .get(MessageRepository)
    .createMessage(id, conversationId, post.kind === "comment" ? "user" : "assistant", body, {
      data: { workPost: { kind: post.kind, author: post.author } },
    });

  return {
    id,
    kind: post.kind,
    author: post.author,
    body,
    createdAt: new Date().toISOString(),
  };
}

export async function listTaskThread(
  context: ServiceContext,
  task: ProjectTask,
): Promise<ProjectTaskThreadPost[]> {
  if (!task.conversationId) {
    return [];
  }

  const rows = await context.repositories
    .get(MessageRepository)
    .getConversationMessages(task.conversationId, THREAD_LIMIT);

  return rows.flatMap((row) => {
    const role = row.role;

    if (role !== "user" && role !== "assistant") {
      return [];
    }

    const body = readMessageText(row.content);

    if (!body) {
      return [];
    }

    const workPost = readWorkPost(row.data);

    if (!workPost && role === "user" && isQuestionResponse(row.data)) {
      return [
        {
          id: typeof row.id === "string" ? row.id : "",
          kind: "comment" as const,
          author: { kind: "system" as const, name: "Answers", userId: null, teammateId: null },
          body: truncateText(body, THREAD_BODY_LIMIT),
          createdAt: typeof row.created_at === "string" ? row.created_at : "",
        },
      ];
    }

    if (!workPost && role === "user") {
      return [
        {
          id: typeof row.id === "string" ? row.id : "",
          kind: "event" as const,
          author: { kind: "system" as const, name: "Flow", userId: null, teammateId: null },
          body: truncateText(body.split(/(?<=\.)\s/)[0] ?? body, RUN_BRIEF_LIMIT),
          createdAt: typeof row.created_at === "string" ? row.created_at : "",
        },
      ];
    }

    const author: WorkPostAuthor = workPost?.author ?? {
      kind: task.owner?.type === "teammate" ? "teammate" : "system",
      name: task.owner?.type === "teammate" ? "Teammate" : "Run",
      userId: null,
      teammateId: task.owner?.type === "teammate" ? task.owner.id : null,
    };

    return [
      {
        id: typeof row.id === "string" ? row.id : "",
        kind: workPost?.kind ?? "update",
        author,
        body: truncateText(body, THREAD_BODY_LIMIT),
        createdAt: typeof row.created_at === "string" ? row.created_at : "",
      },
    ];
  });
}

export async function countThreadPostsSince(
  context: ServiceContext,
  task: ProjectTask,
  since: string,
): Promise<number> {
  const thread = await listTaskThread(context, task);

  return thread.filter((post) => post.createdAt > since && post.author.kind === "teammate").length;
}
