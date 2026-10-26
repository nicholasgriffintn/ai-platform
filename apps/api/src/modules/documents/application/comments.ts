import { authorise } from "@ngriffin_uk/polychat-library-policy";
import type {
  CreateDocumentCommentInput,
  DocumentComment,
  DocumentCommentSubject,
  ResolveDocumentThreadInput,
} from "@ngriffin_uk/polychat-schemas";
import { canonicalJson, locateTextAnchor } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { DocumentCommentRepository } from "~/modules/documents/infrastructure/DocumentCommentRepository";
import { requireProjectAccess } from "~/modules/workspaces/application/access";

import { requireDiscussionSubject } from "./access";
import { publishDocumentCommentsChanged } from "./comment-events";
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
  subject: DocumentCommentSubject,
  after?: string,
) {
  const document = await requireDiscussionSubject(context, userId, subject);
  const role = document.projectId
    ? (await requireProjectAccess(context, document.projectId)).role
    : "owner";
  const facts = {
    actorId: String(userId),
    scope: document.projectId ? "project" : "personal",
    member: true,
    role,
  };

  return {
    ...(await context.repositories.get(DocumentCommentRepository).list(subject, userId, after)),
    permissions: {
      actorUserId: userId,
      canEditDocument: authorise("resource.write", {
        ...facts,
        ownerId: String(document.createdByUserId),
      }).allowed,
      canResolveAllThreads:
        document.projectId !== null &&
        authorise("resource.write", { ...facts, ownerId: "" }).allowed,
    },
  };
}

export async function createDocumentComment(
  context: ServiceContext,
  userId: number,
  subject: DocumentCommentSubject,
  input: CreateDocumentCommentInput,
): Promise<DocumentComment> {
  const document = await requireDiscussionSubject(context, userId, subject);
  const comments = context.repositories.get(DocumentCommentRepository);
  const existing = await comments.get(subject, input.requestId, userId);

  if (existing) {
    assertCommentRetry(existing, input, userId);
    await publishDocumentCommentsChanged(context, document);
    await notifyCommentMention(context, existing);

    return existing;
  }

  if (document.revision !== input.expectedRevision) {
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

  if (input.anchor && locateTextAnchor(document.body, input.anchor).status !== "located") {
    throw new AssistantError(
      "Select an unambiguous passage in this document",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  if (input.parentId) {
    const parent = await comments.get(subject, input.parentId, userId);

    if (!parent || parent.parentId !== null) {
      throw new AssistantError("Thread not found", ErrorType.NOT_FOUND, 404);
    }
  }

  const comment: DocumentComment = {
    id: input.requestId,
    outputId: subject.type === "output" ? subject.id : null,
    sourceId: subject.type === "source" ? subject.id : null,
    parentId: input.parentId,
    anchor: input.anchor,
    sourceRevision: document.revision,
    body: input.body,
    authorUserId: userId,
    resolved: false,
    revision: 1,
    mentionedTeammateId: input.mentionedTeammateId,
    taskId: input.mentionedTeammateId ? `document-comment:${input.requestId}` : null,
    createdAt: new Date().toISOString(),
    updatedAt: null,
  };
  const effects = await prepareCommentMention(context, document.projectId, document.title, comment);
  let saved: DocumentComment;

  try {
    saved = await comments.create(comment, effects);
  } catch (error) {
    const retry = await comments.get(subject, input.requestId, userId);

    if (!retry) {
      throw error;
    }

    assertCommentRetry(retry, input, userId);
    saved = retry;
  }

  await publishDocumentCommentsChanged(context, document);
  await notifyCommentMention(context, saved);

  return saved;
}

export async function resolveDocumentThread(
  context: ServiceContext,
  userId: number,
  subject: DocumentCommentSubject,
  commentId: string,
  input: ResolveDocumentThreadInput,
): Promise<DocumentComment> {
  const document = await requireDiscussionSubject(context, userId, subject);
  const comments = context.repositories.get(DocumentCommentRepository);
  const comment = await comments.get(subject, commentId, userId);

  if (!comment || comment.parentId !== null) {
    throw new AssistantError("Thread not found", ErrorType.NOT_FOUND, 404);
  }

  const role = document.projectId
    ? (await requireProjectAccess(context, document.projectId)).role
    : "owner";
  const permitted = authorise("resource.write", {
    actorId: String(userId),
    ownerId: String(comment.authorUserId),
    scope: document.projectId ? "project" : "personal",
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

  const resolved = await comments.resolve(
    subject,
    commentId,
    input.expectedRevision,
    input.resolved,
    userId,
  );

  await publishDocumentCommentsChanged(context, document);

  return resolved;
}
