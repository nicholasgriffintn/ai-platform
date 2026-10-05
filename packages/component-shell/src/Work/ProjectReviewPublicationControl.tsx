import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FormTextarea,
} from "@ngriffin_uk/polychat-component-ui";
import type { ProjectTask } from "@ngriffin_uk/polychat-schemas";

import { useReviewPublication } from "./useReviewPublication.js";

export function ProjectReviewPublicationControl({
  projectId,
  task,
}: {
  projectId: string;
  task: ProjectTask;
}) {
  const state = useReviewPublication(projectId, task);

  if (!state.review) {
    return state.error ? (
      <p role="alert" className="mb-4 text-sm text-failure">
        {state.error}
      </p>
    ) : null;
  }

  const target = state.review.target;
  const canPublish =
    state.review.publicationStatus === "unpublished" &&
    ["review", "done"].includes(task.status) &&
    task.completions.length > 0;

  return (
    <div className="mb-4 space-y-3 rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Pull request review</p>
          <p className="text-xs text-muted-foreground">
            {target.repository}#{target.pullRequestNumber} · Reviewed head{" "}
            {target.headSha.slice(0, 7)}
          </p>
        </div>
        {state.review.publishedUrl ? (
          <a
            className="text-link text-sm"
            href={state.review.publishedUrl}
            target="_blank"
            rel="noreferrer"
          >
            View published review
          </a>
        ) : canPublish ? (
          <Button
            variant="outline"
            size="sm"
            disabled={state.pending}
            onClick={() => void state.open()}
          >
            Preview publication
          </Button>
        ) : null}
      </div>
      {state.review.publicationStatus === "unknown" ||
      state.review.publicationStatus === "publishing" ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Publication may have succeeded. Check the PR before taking further action.
          </p>
          <Button
            size="sm"
            variant="outline"
            disabled={state.pending}
            onClick={() => void state.check()}
          >
            Check publication
          </Button>
        </div>
      ) : null}
      {state.error ? (
        <p role="alert" className="text-sm text-failure">
          {state.error}
        </p>
      ) : null}
      <Dialog
        open={Boolean(state.prepared)}
        onOpenChange={(open) => {
          if (!open) {
            state.close();
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Publish PR review</DialogTitle>
            <DialogDescription>
              Approve this text for {target.repository}#{target.pullRequestNumber}. The review will
              be tied to commit {target.headSha.slice(0, 7)}. Publication is refused if the PR
              revision has changed.
            </DialogDescription>
          </DialogHeader>
          <FormTextarea
            label="Review text"
            rows={14}
            value={state.body}
            maxLength={60000}
            disabled={state.pending}
            onChange={(event) => state.setBody(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            The reviewed base and head commits are appended to the published review.
          </p>
          {state.error ? (
            <p role="alert" className="text-sm text-failure">
              {state.error}
            </p>
          ) : null}
          <DialogFooter>
            <Button variant="outline" disabled={state.pending} onClick={state.close}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={state.pending || !state.body.trim()}
              onClick={() => void state.approve()}
            >
              Approve and publish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
