import { Button } from "@ngriffin_uk/polychat-component-ui";
import { useProjectReviews } from "@ngriffin_uk/polychat-library-react";
import { GitPullRequest } from "lucide-react";
import { useState } from "react";

import { ProjectReviewSettingsDialog } from "./ProjectReviewSettingsDialog.js";

export function ProjectReviewsRow({
  projectId,
  canManage,
}: {
  projectId: string;
  canManage: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const reviews = useProjectReviews(projectId);
  const enabled = reviews.data?.policies.filter((policy) => policy.enabled) ?? [];

  return (
    <div className="flex flex-wrap items-start gap-3 border-t border-border p-5">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-selection text-muted-foreground">
        <GitPullRequest size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-semibold">Pull request reviews</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {enabled.length
            ? `Reviews open automatically for ${enabled.map((policy) => policy.repository).join(", ")}. Each review is a task on the board.`
            : "Teammates can review GitHub pull requests as tasks on the board."}
        </p>
        {reviews.error ? (
          <p role="alert" className="mt-1 text-xs text-failure">
            {reviews.error.message}
          </p>
        ) : null}
      </div>
      <Button
        size="sm"
        variant="secondary"
        disabled={!reviews.data}
        onClick={() => setIsOpen(true)}
      >
        {enabled.length ? "Manage" : "Set up"}
      </Button>
      {isOpen ? (
        <ProjectReviewSettingsDialog
          projectId={projectId}
          policies={reviews.data?.policies ?? []}
          canManage={canManage}
          onClose={() => setIsOpen(false)}
        />
      ) : null}
    </div>
  );
}
