import { Button, Textarea } from "@ngriffin_uk/polychat-component-ui";
import type {
  DocumentAnchor,
  DocumentComment,
  DocumentEditProposal,
} from "@ngriffin_uk/polychat-schemas";
import { useState } from "react";

import { DocumentCommentThread } from "./DocumentCommentThread";
import { DocumentEditReview } from "./DocumentEditReview";

export interface DocumentDiscussionProps {
  revision: number;
  documentBody: string;
  selection: DocumentAnchor | null;
  hasUnsavedChanges: boolean;
  comments: DocumentComment[];
  teammates: { id: string; name: string }[];
  actorUserId?: number;
  authorNames?: Record<number, string>;
  canEditDocument: boolean;
  canResolveAllThreads: boolean;
  isLoading: boolean;
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
  isSaving: boolean;
  isProposing: boolean;
  isApplying: boolean;
  errorMessage?: string;
  taskHref?: (taskId: string) => string;
  onComment: (
    body: string,
    parentId: string | null,
    mentionedTeammateId: string | null,
  ) => Promise<boolean>;
  onResolve: (thread: DocumentComment) => Promise<boolean>;
  onPropose: (instructions: string) => Promise<DocumentEditProposal | null>;
  onApply: (proposal: DocumentEditProposal) => Promise<boolean>;
}

export function DocumentDiscussion(props: DocumentDiscussionProps) {
  const [body, setBody] = useState("");
  const [teammateId, setTeammateId] = useState("");
  const [instructions, setInstructions] = useState("");
  const [proposal, setProposal] = useState<DocumentEditProposal | null>(null);
  const disabled = props.hasUnsavedChanges || props.isSaving || props.isApplying;
  const selectionTooLarge = Boolean(props.selection && props.selection.quote.length > 20_000);

  return (
    <div className="space-y-4 p-3">
      <h2 className="text-sm font-medium">Discussion</h2>
      {props.errorMessage ? (
        <p role="alert" className="text-xs text-failure">
          {props.errorMessage}
        </p>
      ) : null}
      {props.hasUnsavedChanges ? (
        <p className="text-xs text-muted-foreground">
          Save your draft before commenting or proposing an edit.
        </p>
      ) : null}
      {selectionTooLarge ? (
        <p className="text-xs text-muted-foreground">
          Select a shorter passage, up to 20,000 characters.
        </p>
      ) : null}
      {props.selection ? (
        <blockquote className="max-h-20 overflow-auto border-l-2 border-border pl-2 text-xs text-muted-foreground">
          {props.selection.quote}
        </blockquote>
      ) : (
        <p className="text-xs text-muted-foreground">
          Select a passage to discuss it or propose an edit.
        </p>
      )}
      <form
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          void props.onComment(body, null, teammateId || null).then((saved) => {
            if (saved) {
              setBody("");
              setTeammateId("");
            }

            return saved;
          });
        }}
      >
        <Textarea
          aria-label="New comment"
          disabled={props.isSaving}
          value={body}
          onChange={(event) => setBody(event.currentTarget.value)}
          maxLength={10_000}
          rows={3}
        />
        {props.teammates.length ? (
          <label className="block space-y-1 text-xs">
            <span>Ask a teammate</span>
            <select
              aria-label="Mention teammate"
              className="w-full rounded border border-border bg-surface p-2"
              disabled={props.isSaving}
              value={teammateId}
              onChange={(event) => setTeammateId(event.currentTarget.value)}
            >
              <option value="">No teammate</option>
              {props.teammates.map((teammate) => (
                <option key={teammate.id} value={teammate.id}>
                  {teammate.name}
                </option>
              ))}
            </select>
            <span className="text-muted-foreground">
              Creates a task on the project board for you to start.
            </span>
          </label>
        ) : null}
        <Button size="xs" type="submit" disabled={disabled || selectionTooLarge || !body.trim()}>
          Add comment
        </Button>
      </form>
      {props.canEditDocument ? (
        <form
          className="space-y-2 border-t border-border pt-3"
          onSubmit={(event) => {
            event.preventDefault();
            void props.onPropose(instructions).then((suggested) => {
              if (suggested) {
                setProposal(suggested);
              }

              return suggested;
            });
          }}
        >
          <Textarea
            aria-label="Selection edit instructions"
            placeholder="How should this passage change?"
            value={instructions}
            onChange={(event) => setInstructions(event.currentTarget.value)}
            maxLength={2000}
            rows={2}
          />
          <Button
            size="xs"
            type="submit"
            variant="outline"
            isLoading={props.isProposing}
            disabled={disabled || selectionTooLarge || !props.selection || !instructions.trim()}
          >
            Propose edit
          </Button>
        </form>
      ) : null}
      {proposal ? (
        <DocumentEditReview
          proposal={proposal}
          stale={proposal.sourceRevision !== props.revision}
          disabled={disabled || !props.canEditDocument}
          isApplying={props.isApplying}
          onChange={(replacement) => setProposal(proposal ? { ...proposal, replacement } : null)}
          onDismiss={() => setProposal(null)}
          onApply={() => {
            if (proposal) {
              void props.onApply(proposal).then((applied) => {
                if (applied) {
                  setProposal(null);
                }

                return applied;
              });
            }
          }}
        />
      ) : null}
      {props.isLoading ? (
        <p className="text-xs text-muted-foreground">Loading discussion…</p>
      ) : null}
      {props.comments
        .filter((comment) => !comment.parentId)
        .map((thread) => (
          <DocumentCommentThread
            key={thread.id}
            thread={thread}
            replies={props.comments.filter((comment) => comment.parentId === thread.id)}
            documentBody={props.documentBody}
            actorUserId={props.actorUserId}
            authorNames={props.authorNames}
            canResolve={props.canResolveAllThreads || props.actorUserId === thread.authorUserId}
            disabled={disabled}
            onResolve={props.onResolve}
            onReply={(replyBody, parentId) => props.onComment(replyBody, parentId, null)}
            taskHref={thread.taskId ? props.taskHref?.(thread.taskId) : undefined}
          />
        ))}
      {props.hasMore ? (
        <Button
          size="xs"
          variant="outline"
          isLoading={props.isLoadingMore}
          onClick={props.onLoadMore}
        >
          Load more discussion
        </Button>
      ) : null}
    </div>
  );
}
