import { Button, Textarea } from "@ngriffin_uk/polychat-component-ui";
import type { DocumentComment } from "@ngriffin_uk/polychat-schemas";
import { formatRelativeTime, locateTextAnchor } from "@ngriffin_uk/polychat-utility-core";

import { useDocumentCommentDraft } from "./useDocumentDiscussionDraft";

interface DocumentCommentThreadProps {
  thread: DocumentComment;
  replies: DocumentComment[];
  documentBody: string;
  actorUserId?: number;
  authorNames?: Record<number, string>;
  canResolve: boolean;
  disabled: boolean;
  onResolve: (thread: DocumentComment) => Promise<boolean>;
  onReply: (body: string, parentId: string) => Promise<boolean>;
  taskHref?: string;
}

export function DocumentCommentThread({
  thread,
  replies,
  documentBody,
  actorUserId,
  authorNames,
  canResolve,
  disabled,
  onResolve,
  onReply,
  taskHref,
}: DocumentCommentThreadProps) {
  const {
    body: reply,
    setBody: setReply,
    submitComment,
  } = useDocumentCommentDraft((body) => onReply(body, thread.id));
  const anchorStatus = thread.anchor ? locateTextAnchor(documentBody, thread.anchor).status : null;

  return (
    <article className="space-y-2 rounded-md border border-border p-3 text-sm">
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{thread.resolved ? "Resolved" : "Open thread"}</span>
        {canResolve ? (
          <Button
            size="xs"
            variant="outline"
            disabled={disabled}
            onClick={() => void onResolve(thread)}
          >
            {thread.resolved ? "Reopen" : "Resolve"}
          </Button>
        ) : null}
      </div>
      {thread.anchor ? (
        <blockquote className="max-h-24 overflow-auto border-l-2 border-border pl-2 text-xs text-muted-foreground">
          {thread.anchor.quote}
          {anchorStatus !== "located" ? (
            <p className="mt-1">
              The original passage is{" "}
              {anchorStatus === "ambiguous" ? "ambiguous" : "no longer in this revision"}.
            </p>
          ) : null}
        </blockquote>
      ) : null}
      <p className="break-words whitespace-pre-wrap">{thread.body}</p>
      <p className="text-xs text-muted-foreground">
        {thread.authorUserId === actorUserId
          ? "You"
          : (authorNames?.[thread.authorUserId] ?? "Member")}{" "}
        · {formatRelativeTime(thread.createdAt)}
      </p>
      {thread.taskId && taskHref ? (
        <a className="text-xs underline" href={taskHref}>
          Open teammate task
        </a>
      ) : null}
      {replies.map((comment) => (
        <div key={comment.id} className="border-t border-border pt-2">
          <p className="break-words whitespace-pre-wrap">{comment.body}</p>
          <p className="text-xs text-muted-foreground">
            {comment.authorUserId === actorUserId
              ? "You"
              : (authorNames?.[comment.authorUserId] ?? "Member")}
          </p>
        </div>
      ))}
      <form
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          void submitComment();
        }}
      >
        <Textarea
          aria-label="Reply to thread"
          disabled={disabled}
          value={reply}
          maxLength={10_000}
          onChange={(event) => setReply(event.currentTarget.value)}
          rows={2}
        />
        <Button type="submit" size="xs" variant="outline" disabled={disabled || !reply.trim()}>
          Reply
        </Button>
      </form>
    </article>
  );
}
