import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import {
  listPageOf,
  type ListPage,
  type CreateNotebookInput,
  type CreateNotebookNoteInput,
  type Notebook,
  type NotebookDetail,
  type NotebookGuideStatus,
  type SourceSummary,
  type UpdateNotebookInput,
} from "@ngriffin_uk/polychat-schemas";
import { sha256Hex } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { sanitiseInput } from "@ngriffin_uk/polychat-utility-server/sanitise";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import {
  createConversationGroup,
  deleteConversationGroup,
} from "~/modules/conversations/application/conversation-organisation";
import { readKnowledgeText, withKnowledgeText } from "~/modules/knowledge/application/intake/body";
import { fileKnowledgeSource } from "~/modules/knowledge/application/intake/file";
import {
  formatNotebook,
  isGuideCurrent,
  notebookSourceRole,
  readNotebookGuide,
  readNotebookSettings,
} from "~/modules/notebooks/domain/notebook";
import {
  NotebookRepository,
  type NotebookRecord,
} from "~/modules/notebooks/infrastructure/NotebookRepository";
import { formatOutputSummary } from "~/modules/outputs/application";
import { OutputRepository } from "~/modules/outputs/infrastructure/OutputRepository";
import { TaskRepository } from "~/modules/queue/infrastructure/TaskRepository";
import {
  formatSourceSummary,
  requireSourcesAccess,
  toSourceSummary,
} from "~/modules/sources/application/sources";
import {
  SourceRepository,
  type SourceRecord,
} from "~/modules/sources/infrastructure/SourceRepository";
import { requireProjectAccess } from "~/modules/workspaces/application/access";

import { requireNotebookAccess, type NotebookAccess } from "./access";
import { enqueueNotebookJob } from "./jobs";

const logger = getLogger({ prefix: "notebooks" });

export async function createNotebook(
  context: ServiceContext,
  input: CreateNotebookInput,
): Promise<Notebook> {
  const { group } = await createConversationGroup(context, input);
  const access = await requireNotebookAccess(context, group.id);

  return formatNotebook(access.notebook, access.canManage);
}

export async function deleteNotebook(context: ServiceContext, notebookId: string): Promise<void> {
  await requireNotebookAccess(context, notebookId, { manage: true });
  await deleteConversationGroup(context, notebookId);
}

export async function listNotebooks(
  context: ServiceContext,
  projectId?: string,
): Promise<ListPage<Notebook>> {
  const user = context.requireUser();

  if (projectId) {
    const { role } = await requireProjectAccess(context, projectId);
    const records = await context.repositories
      .get(NotebookRepository)
      .listProjectNotebooks(projectId);

    return listPageOf(
      records.map((record) => formatNotebook(record, role === "owner" || role === "admin")),
      (notebook) => notebook.id,
    );
  }

  const records = await context.repositories.get(NotebookRepository).listPersonalNotebooks(user.id);

  return listPageOf(
    records.map((record) => formatNotebook(record, true)),
    (notebook) => notebook.id,
  );
}

async function listLinkedSources(
  context: ServiceContext,
  notebookId: string,
): Promise<SourceSummary[]> {
  const records = await context.repositories
    .get(SourceRepository)
    .listCollectionSourceSummaries(notebookId);

  return records.map(formatSourceSummary);
}

export async function getNotebookDetail(
  context: ServiceContext,
  notebookId: string,
): Promise<NotebookDetail> {
  const { notebook, canManage } = await requireNotebookAccess(context, notebookId);
  const [linked, generations, outputs, conversations] = await Promise.all([
    listLinkedSources(context, notebookId),
    context.repositories.get(SourceRepository).listConversationGroupGenerations(notebookId),
    context.repositories.get(OutputRepository).listCollectionOutputs(notebookId),
    context.repositories.get(NotebookRepository).listConversations(notebook),
  ]);
  const linkedIds = new Set(linked.map((source) => source.id));
  const guideStatus = await resolveGuideStatus(context, notebook, linked);
  const chatMedia = generations
    .filter((record) => !linkedIds.has(record.id))
    .map(formatSourceSummary);

  return {
    ...formatNotebook(notebook, canManage),
    guideStatus,
    sources: linked.filter((source) => notebookSourceRole(source) === "source"),
    notes: linked.filter((source) => notebookSourceRole(source) === "note"),
    media: [...linked.filter((source) => notebookSourceRole(source) === "media"), ...chatMedia],
    outputs: outputs.map(formatOutputSummary),
    conversations: conversations.map((conversation) => ({
      id: conversation.id,
      title: conversation.title,
      updatedAt: conversation.updated_at,
    })),
  };
}

export async function updateNotebook(
  context: ServiceContext,
  notebookId: string,
  input: UpdateNotebookInput,
): Promise<Notebook> {
  const { notebook } = await requireNotebookAccess(context, notebookId, { manage: true });
  const title = input.name === undefined ? undefined : sanitiseInput(input.name);

  if (title === "") {
    throw new AssistantError("A notebook needs a name", ErrorType.PARAMS_ERROR, 400);
  }

  const updated = await context.repositories.get(NotebookRepository).updateNotebook(notebookId, {
    title,
    instructions: input.instructions,
    settings: input.settings
      ? { ...readNotebookSettings(notebook.settings), ...input.settings }
      : undefined,
  });

  if (!updated) {
    throw new AssistantError(
      "A notebook with this name already exists",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  const access = await requireNotebookAccess(context, notebookId);

  return formatNotebook(access.notebook, access.canManage);
}

function readableSourceIds(sources: readonly SourceSummary[]): string[] {
  return sources
    .filter((source) => notebookSourceRole(source) === "source" && source.status === "available")
    .map((source) => source.id)
    .sort();
}

async function resolveGuideStatus(
  context: ServiceContext,
  notebook: NotebookRecord,
  sources: readonly SourceSummary[],
): Promise<NotebookGuideStatus> {
  const sourceIds = readableSourceIds(sources);

  if (sourceIds.length === 0) {
    return "unavailable";
  }

  if (isGuideCurrent(readNotebookGuide(notebook.guide), sourceIds)) {
    return "current";
  }

  const taskId = `notebook-guide-${notebook.id}-${(await sha256Hex(sourceIds.join(","))).slice(0, 16)}`;
  const existing = await context.repositories.get(TaskRepository).getTaskById(taskId);

  if (existing) {
    return ["pending", "queued", "running"].includes(existing.status) ? "writing" : "unavailable";
  }

  await enqueueNotebookJob(
    context,
    notebook.project_id,
    { job: "guide", notebookId: notebook.id },
    taskId,
  ).catch((error: unknown) => {
    logger.warn("Notebook guide could not be queued", { notebookId: notebook.id, error });
  });

  return "writing";
}

function assertNotebookScope(access: NotebookAccess, userId: number) {
  return (source: SourceRecord) => {
    const matchesScope = access.notebook.project_id
      ? source.project_id === access.notebook.project_id
      : source.project_id === null && source.created_by_user_id === userId;

    if (!matchesScope) {
      throw new AssistantError(
        "Sources must belong to the same place as the notebook",
        ErrorType.PARAMS_ERROR,
        400,
      );
    }
  };
}

export async function linkNotebookSources(
  context: ServiceContext,
  notebookId: string,
  sourceIds: string[],
): Promise<NotebookDetail> {
  const user = context.requireUser();
  const access = await requireNotebookAccess(context, notebookId);

  await requireSourcesAccess(context, user.id, sourceIds, assertNotebookScope(access, user.id));
  await context.repositories.get(SourceRepository).addCollectionSources(notebookId, sourceIds);

  return getNotebookDetail(context, notebookId);
}

export async function unlinkNotebookSource(
  context: ServiceContext,
  notebookId: string,
  sourceId: string,
): Promise<NotebookDetail> {
  await requireNotebookAccess(context, notebookId);
  await context.repositories.get(SourceRepository).removeCollectionSource(notebookId, sourceId);

  return getNotebookDetail(context, notebookId);
}

export async function createNotebookNote(
  context: ServiceContext,
  notebookId: string,
  input: CreateNotebookNoteInput,
): Promise<SourceSummary> {
  await requireNotebookAccess(context, notebookId);
  const note = await fileKnowledgeSource(context, {
    origin: "note",
    notebookId,
    kind: "text",
    title: sanitiseInput(input.title) || "Note",
    provider: null,
    content: sanitiseInput(input.content),
    metadata: { note: true },
  });

  return toSourceSummary(note);
}

export async function promoteNotebookNote(
  context: ServiceContext,
  notebookId: string,
  noteId: string,
): Promise<NotebookDetail> {
  const user = context.requireUser();
  const access = await requireNotebookAccess(context, notebookId);
  const [note] = await requireSourcesAccess(
    context,
    user.id,
    [noteId],
    assertNotebookScope(access, user.id),
  );
  const linked = await listLinkedSources(context, notebookId);
  const linkedNote = linked.find((source) => source.id === noteId);

  if (!linkedNote || notebookSourceRole(linkedNote) !== "note") {
    throw new AssistantError("Note not found in this notebook", ErrorType.NOT_FOUND, 404);
  }

  await fileKnowledgeSource(context, {
    origin: "note",
    notebookId,
    kind: "text",
    title: note.title,
    provider: null,
    content: await readKnowledgeText(context, note),
    metadata: { fromNoteId: note.id },
  });

  return getNotebookDetail(context, notebookId);
}

export async function resolveNotebookSources(
  context: ServiceContext,
  access: NotebookAccess,
  requestedIds?: readonly string[],
): Promise<SourceRecord[]> {
  const linkedIds = readableSourceIds(await listLinkedSources(context, access.notebook.id));
  const requested = requestedIds ? new Set(requestedIds) : null;
  const selected = requested ? linkedIds.filter((sourceId) => requested.has(sourceId)) : linkedIds;

  return withKnowledgeText(
    context,
    await context.repositories.get(SourceRepository).getSourcesByIds(selected),
  );
}
