import { extractTextFromMessageContent } from "@ngriffin_uk/polychat-ai-providers";
import {
  workPostAuthorSchema,
  workPostKindSchema,
  type ProjectTask,
  type ProjectTaskThreadPost,
  type WorkPostAuthor,
  type WorkPostKind,
} from "@ngriffin_uk/polychat-schemas";
import { generateId, truncateText } from "@ngriffin_uk/polychat-utility-core";
import { parseJsonRecord } from "@ngriffin_uk/polychat-utility-server/json";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { formatStoredMessage } from "~/modules/conversations/application/stored-message";
import { MessageRepository } from "~/modules/conversations/infrastructure/MessageRepository";
import { ProjectTaskRepository } from "~/modules/project-tasks/infrastructure/ProjectTaskRepository";

import { ensureProjectTaskConversation, projectTaskConversationId } from "./runner";

const THREAD_LIMIT = 200;
const THREAD_BODY_LIMIT = 4000;

function readWorkPost(data: unknown): { kind: WorkPostKind; author: WorkPostAuthor } | null {
  const post = parseJsonRecord(parseJsonRecord(data).workPost);
  const kind = workPostKindSchema.safeParse(post.kind);
  const author = workPostAuthorSchema.safeParse(post.author);

  return kind.success && author.success ? { kind: kind.data, author: author.data } : null;
}

function systemAuthor(name: string): WorkPostAuthor {
  return { kind: "system", name, userId: null, teammateId: null };
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
    const body = extractTextFromMessageContent(formatStoredMessage(row).content);

    if ((role !== "user" && role !== "assistant") || !body) {
      return [];
    }

    const post = (kind: WorkPostKind, author: WorkPostAuthor, text: string) => [
      {
        id: typeof row.id === "string" ? row.id : "",
        kind,
        author,
        body: text,
        createdAt: typeof row.created_at === "string" ? row.created_at : "",
      },
    ];
    const workPost = readWorkPost(row.data);

    if (workPost) {
      return post(workPost.kind, workPost.author, truncateText(body, THREAD_BODY_LIMIT));
    }

    if (role === "user" && "userQuestionResponse" in parseJsonRecord(row.data)) {
      return post("comment", systemAuthor("Answers"), truncateText(body, THREAD_BODY_LIMIT));
    }

    if (role === "user") {
      return post("event", systemAuthor("Run"), "Started a run");
    }

    return post(
      "update",
      task.owner?.type === "teammate"
        ? { kind: "teammate", name: "Teammate", userId: null, teammateId: task.owner.id }
        : systemAuthor("Run"),
      truncateText(body, THREAD_BODY_LIMIT),
    );
  });
}
