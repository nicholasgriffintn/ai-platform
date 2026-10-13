import { ApiError } from "@ngriffin_uk/polychat-library-client";
import { useDocumentCollaboration } from "@ngriffin_uk/polychat-library-react";
import type {
  CreateDocumentCommentInput,
  DocumentAnchor,
  DocumentComment,
  DocumentEditProposal,
  Output,
} from "@ngriffin_uk/polychat-schemas";
import { canonicalJson, generateId } from "@ngriffin_uk/polychat-utility-core";
import { useRef } from "react";

export function useDocumentDiscussion(output: Output) {
  const collaboration = useDocumentCollaboration(output.id);
  const request = useRef<{ key: string; input: CreateDocumentCommentInput } | null>(null);

  async function onComment(
    body: string,
    parentId: string | null,
    mentionedTeammateId: string | null,
    selection: DocumentAnchor | null,
  ): Promise<boolean> {
    const anchor = parentId ? null : selection;
    const key = canonicalJson({ body: body.trim(), parentId, anchor, mentionedTeammateId });

    if (!request.current || request.current.key !== key) {
      request.current = {
        key,
        input: {
          requestId: generateId(),
          expectedRevision: output.revision,
          body: body.trim(),
          parentId,
          anchor,
          mentionedTeammateId,
        },
      };
    }

    try {
      await collaboration.create.mutateAsync(request.current.input);
      request.current = null;

      return true;
    } catch (error) {
      if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
        request.current = null;
      }

      return false;
    }
  }

  async function onResolve(thread: DocumentComment): Promise<boolean> {
    try {
      await collaboration.resolve.mutateAsync({
        commentId: thread.id,
        expectedRevision: thread.revision,
        resolved: !thread.resolved,
      });

      return true;
    } catch {
      return false;
    }
  }

  async function onPropose(
    instructions: string,
    selection: DocumentAnchor | null,
  ): Promise<DocumentEditProposal | null> {
    if (!selection) {
      return null;
    }

    try {
      return await collaboration.propose.mutateAsync({
        expectedRevision: output.revision,
        anchor: selection,
        instructions,
      });
    } catch {
      return null;
    }
  }

  async function onApply(proposal: DocumentEditProposal): Promise<boolean> {
    try {
      await collaboration.apply.mutateAsync(proposal);

      return true;
    } catch {
      return false;
    }
  }

  const error =
    collaboration.create.error ??
    collaboration.resolve.error ??
    collaboration.propose.error ??
    collaboration.apply.error ??
    collaboration.comments.error;

  return {
    ...collaboration,
    onComment,
    onResolve,
    onPropose,
    onApply,
    errorMessage: error?.message,
  };
}
