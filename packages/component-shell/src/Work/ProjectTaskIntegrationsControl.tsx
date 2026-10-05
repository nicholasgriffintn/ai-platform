import { Button } from "@ngriffin_uk/polychat-component-ui";
import { useProjectReviews } from "@ngriffin_uk/polychat-library-react";
import { useState } from "react";
import { useNavigate } from "react-router";

import { ImportProjectIssueDialog } from "./ImportProjectIssueDialog.js";
import { ProjectReviewSettingsDialog } from "./ProjectReviewSettingsDialog.js";

export function ProjectTaskIntegrationsControl({
  projectId,
  taskBasePath,
  canManage,
}: {
  projectId: string;
  taskBasePath: string;
  canManage: boolean;
}) {
  const [dialog, setDialog] = useState<"issue" | "review" | null>(null);
  const reviews = useProjectReviews(projectId);
  const navigate = useNavigate();

  return (
    <div className="mb-6 space-y-3 rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Engineering intake</p>
          <p className="text-xs text-muted-foreground">
            Bring an issue into Work or review a GitHub pull request.
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setDialog("issue")}>
            Import issue
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!reviews.data}
            onClick={() => setDialog("review")}
          >
            PR reviews
          </Button>
        </div>
      </div>
      {reviews.data?.policies
        .filter((policy) => policy.enabled)
        .map((policy) => (
          <p key={policy.id} className="text-xs text-muted-foreground">
            Automatic reviews enabled for {policy.repository} ({policy.provider}).
          </p>
        ))}
      {reviews.data?.reviews.slice(0, 5).map((review) => (
        <div key={review.id} className="flex flex-wrap justify-between gap-2 text-sm">
          <a className="text-link" href={`${taskBasePath}/${review.taskId}`}>
            {review.target.repository}#{review.target.pullRequestNumber} ·{" "}
            {review.target.headSha.slice(0, 7)}
          </a>
          <span className="text-xs text-muted-foreground">
            {review.publicationStatus === "published"
              ? "Published"
              : review.publicationStatus === "unknown" || review.publicationStatus === "publishing"
                ? "Check publication"
                : "Not published"}
          </span>
        </div>
      ))}
      {reviews.error ? (
        <p role="alert" className="text-sm text-failure">
          {reviews.error.message}
        </p>
      ) : null}
      {dialog === "issue" ? (
        <ImportProjectIssueDialog
          projectId={projectId}
          taskBasePath={taskBasePath}
          onClose={() => setDialog(null)}
          onImported={(taskId) => {
            setDialog(null);
            void navigate(`${taskBasePath}/${taskId}`);
          }}
        />
      ) : null}
      {dialog === "review" ? (
        <ProjectReviewSettingsDialog
          projectId={projectId}
          policies={reviews.data?.policies ?? []}
          canManage={canManage}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </div>
  );
}
