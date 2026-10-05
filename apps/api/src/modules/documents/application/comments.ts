import { authorise } from "@ngriffin_uk/polychat-library-policy";
import type {
  CreateDocumentCommentInput,
  DocumentComment,
  ResolveDocumentThreadInput,
} from "@ngriffin_uk/polychat-schemas";
import { canonicalJson, locateTextAnchor } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { requireProjectAccess } from "~/modules/workspaces/application/access";

import { requireDocument } from "./access";
import { notifyCommentMention, prepareCommentMention } from "./comment-mentions";

function assertCommentRetry(
  comment: DocumentComment,
  input: CreateDocumentCommentInput,
  userId: number,
): void {
  if (
    comment.authorUserId !== userId ||
    comment.body !== input.body ||
    comment.sourceRevision !== input.expectedRevision ||
    comment.parentId !== input.parentId ||
    canonicalJson(comment.anchor) !== canonicalJson(input.anchor) ||
    comment.mentionedTeammateId !== input.mentionedTeammateId
  ) {
    throw new AssistantError(
      "This request ID was already used for another comment",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }
}

export async function listDocumentComments(
  context: ServiceContext,
  userId: number,
  outputId: string,
  after?: string,
) {
  const { output } = await requireDocument(context, userId, outputId);
  const role = output.projectId
    ? (await requireProjectAccess(context, output.projectId)).role
    : "owner";
  const facts = {
    actorId: String(userId),
    scope: output.projectId ? "project" : "personal",
    member: true,
    role,
  };

  return {
    ...(await context.repositories.documentComments.list(outputId, userId, after)),
    permissions: {
      actorUserId: userId,
      canEditDocument: authorise("resource.write", {
        ...facts,
        ownerId: String(output.createdByUserId),
      }).allowed,
      canResolveAllThreads:
        output.projectId !== null && authorise("resource.write", { ...facts, ownerId: "" }).allowed,
    },
  };
}

export async function createDocumentComment(
  context: ServiceContext,
  userId: number,
  outputId: string,
  input: CreateDocumentCommentInput,
): Promise<DocumentComment> {
  const { output, body } = await requireDocument(context, userId, outputId);
  const existing = await context.repositories.documentComments.get(
    outputId,
    input.requestId,
    userId,
  );

  if (existing) {
    assertCommentRetry(existing, input, userId);
    await notifyCommentMention(context, existing);

    return existing;
  }

  if (output.revision !== input.expectedRevision) {
    throw new AssistantError(
      "The document has changed. Refresh and select the text again.",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  if (input.parentId && input.anchor) {
    throw new AssistantError(
      "Replies use the thread's original selection",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  if (input.anchor && locateTextAnchor(body, input.anchor).status !== "located") {
    throw new AssistantError(
      "Select an unambiguous passage in this document",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  if (input.parentId) {
    const parent = await context.repositories.documentComments.get(
      outputId,
      input.parentId,
      userId,
    );

    if (!parent || parent.parentId !== null) {
      throw new AssistantError("Thread not found", ErrorType.NOT_FOUND, 404);
    }
  }

  const comment: DocumentComment = {
    id: input.requestId,
    outputId,
    parentId: input.parentId,
    anchor: input.anchor,
    sourceRevision: output.revision,
    body: input.body,
    authorUserId: userId,
    resolved: false,
    revision: 1,
    mentionedTeammateId: input.mentionedTeammateId,
    taskId: input.mentionedTeammateId ? `document-comment:${input.requestId}` : null,
    createdAt: new Date().toISOString(),
    updatedAt: null,
  };
  const effects = await prepareCommentMention(context, output.projectId, output.title, comment);
  let saved: DocumentComment;

  try {
    saved = await context.repositories.documentComments.create(comment, effects);
  } catch (error) {
    const retry = await context.repositories.documentComments.get(
      outputId,
      input.requestId,
      userId,
    );

    if (!retry) {
      throw error;
    }

    assertCommentRetry(retry, input, userId);
    saved = retry;
  }

  await notifyCommentMention(context, saved);

  return saved;
}

export async function resolveDocumentThread(
  context: ServiceContext,
  userId: number,
  outputId: string,
  commentId: string,
  input: ResolveDocumentThreadInput,
): Promise<DocumentComment> {
  const { output } = await requireDocument(context, userId, outputId);
  const comment = await context.repositories.documentComments.get(outputId, commentId, userId);

  if (!comment || comment.parentId !== null) {
    throw new AssistantError("Thread not found", ErrorType.NOT_FOUND, 404);
  }

  const role = output.projectId
    ? (await requireProjectAccess(context, output.projectId)).role
    : "owner";
  const permitted = authorise("resource.write", {
    actorId: String(userId),
    ownerId: String(comment.authorUserId),
    scope: output.projectId ? "project" : "personal",
    member: true,
    role,
  }).allowed;

  if (!permitted) {
    throw new AssistantError(
      "Only the thread author or a project admin can resolve it",
      ErrorType.FORBIDDEN,
      403,
    );
  }

  return context.repositories.documentComments.resolve(
    outputId,
    commentId,
    input.expectedRevision,
    input.resolved,
    userId,
  );
}
