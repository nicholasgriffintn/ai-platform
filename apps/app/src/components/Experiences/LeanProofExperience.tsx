import {
  LeanProofCreateForm,
  LeanProofHistory,
  LeanProofRunDetail,
} from "@ngriffin_uk/polychat-component-experiences/development";
import { BackLink, EmptyState } from "@ngriffin_uk/polychat-component-ui";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import { useLeanProof, useLeanProofs } from "~/hooks/useLeanProofs";
import { getErrorMessage } from "~/lib/errors";

export interface LeanProofExperienceProps {
  basePath: string;
  projectBasePath: string;
  projectId: string;
  repository: string | null;
  subpath: string;
}

export function LeanProofExperience({
  basePath,
  projectBasePath,
  projectId,
  repository,
  subpath,
}: LeanProofExperienceProps) {
  const taskId = subpath.split("/").find(Boolean);
  const proofRuns = useLeanProofs(projectId);
  const detail = useLeanProof(projectId, taskId ?? "");
  const navigate = useNavigate();

  if (taskId) {
    if (detail.isLoading) {
      return <p className="text-sm text-zinc-500">Loading the proof run…</p>;
    }

    if (detail.error || !detail.data) {
      return (
        <div className="space-y-4">
          <BackLink href={basePath} label="Back to proof runs" />
          <EmptyState
            title="Proof run unavailable"
            message={detail.error?.message ?? "This proof run was not found."}
          />
        </div>
      );
    }

    const { task, goal, output, result } = detail.data;

    return (
      <div className="space-y-5">
        <BackLink href={basePath} label="Back to proof runs" />
        <LeanProofRunDetail
          task={task}
          goal={goal}
          result={result}
          outputHref={output ? `${projectBasePath}/outputs/${output.id}` : null}
          isRetrying={proofRuns.retry.isPending}
          isReviewing={proofRuns.approve.isPending}
          onRetry={() => {
            proofRuns.retry.mutate(task.id, {
              onSuccess: () => toast.success("Proof run queued"),
              onError: (error) => toast.error(getErrorMessage(error, "Unable to retry proof")),
            });
          }}
          onApprove={() => {
            proofRuns.approve.mutate(task.id, {
              onSuccess: () => toast.success("Proof result approved"),
              onError: (error) => toast.error(getErrorMessage(error, "Unable to approve result")),
            });
          }}
        />
      </div>
    );
  }

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
      <LeanProofCreateForm
        repository={repository}
        repositorySettingsHref={projectBasePath}
        isSubmitting={proofRuns.create.isPending}
        serverError={proofRuns.create.error?.message}
        onSubmit={async (input) => {
          const { task } = await proofRuns.create.mutateAsync(input);

          toast.success("Proof run started");
          void navigate(`${basePath}/${task.id}`);
        }}
      />
      <LeanProofHistory
        isLoading={proofRuns.isLoading}
        runs={proofRuns.tasks.map((task) => ({
          id: task.id,
          objective: task.objective,
          targetPaths: task.runner?.kind === "sandbox" ? task.runner.request.targetPaths : [],
          status: task.status,
          outcome: null,
          updatedAt: task.updatedAt ?? task.createdAt,
          href: `${basePath}/${task.id}`,
        }))}
      />
      {proofRuns.error ? (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400 xl:col-start-2">
          {getErrorMessage(proofRuns.error, "Unable to load proof runs")}
        </p>
      ) : null}
    </div>
  );
}
