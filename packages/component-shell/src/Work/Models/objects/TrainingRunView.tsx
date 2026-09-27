import {
  ComputeMeter,
  LossChart,
  PlatformTable,
  RunStatusBadge,
  SpecView,
  StatTile,
  TRAINING_METHOD_LABELS,
} from "@ngriffin_uk/polychat-component-models";
import { Badge, Button } from "@ngriffin_uk/polychat-component-ui";
import { useModelPlatformMutations, useTrainingRun } from "@ngriffin_uk/polychat-library-react";
import { ACTIVE_TRAINING_RUN_STATUSES } from "@ngriffin_uk/polychat-schemas";
import { formatRelativeTime, formatUsd } from "@ngriffin_uk/polychat-utility-core";

import { runWithToast } from "../../../utils/toast-action.js";
import { useModelsScope } from "../ModelsScope.js";
import { ModelsSection } from "../ModelsSection.js";
import { ModelObjectPage } from "./ModelObjectPage.js";

function RunBody({ runId }: { runId: string }) {
  const { workspaceId, open, can } = useModelsScope();
  const run = useTrainingRun(workspaceId, runId).data;
  const mutations = useModelPlatformMutations(workspaceId);

  if (!run) {
    return null;
  }

  const active = ACTIVE_TRAINING_RUN_STATUSES.includes(run.status);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-2">
        <RunStatusBadge status={run.status} />
        <Badge variant="outline">{TRAINING_METHOD_LABELS[run.spec.method]}</Badge>
        <Badge variant="outline">{run.spec.adaptation}</Badge>
        <span className="text-xs text-muted-foreground">
          {run.spec.target.provider} · {run.spec.target.target}
          {run.spec.target.hardware ? ` · ${run.spec.target.hardware}` : ""}
        </span>
        {run.outputVersionId && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => open("versions", run.outputVersionId ?? "")}
          >
            Open the trained model
          </Button>
        )}
        {active && can("train") && (
          <Button
            size="sm"
            variant="destructive"
            disabled={mutations.cancelRun.isPending || run.status === "cancelling"}
            onClick={() =>
              void runWithToast("Cancellation requested", () =>
                mutations.cancelRun.mutateAsync(run.id),
              )
            }
          >
            Cancel
          </Button>
        )}
      </div>
      {run.failureReason && <p className="text-sm text-failure">{run.failureReason}</p>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile
          label="Estimate"
          value={formatUsd(run.estimate.usd)}
          detail={run.estimate.basis}
        />
        <StatTile label="Cost so far" value={formatUsd(run.costUsd)} />
        <StatTile label="Started" value={run.startedAt ? formatRelativeTime(run.startedAt) : "—"} />
        <StatTile
          label="Finished"
          value={run.completedAt ? formatRelativeTime(run.completedAt) : "—"}
        />
      </div>

      <ModelsSection title="Metrics">
        <LossChart metrics={run.metrics} />
      </ModelsSection>

      <ModelsSection
        title="Checkpoints"
        description="Each registered checkpoint becomes its own governed version."
      >
        <PlatformTable
          rows={run.checkpoints}
          rowKey={(checkpoint) => checkpoint.id}
          onOpen={(checkpoint) => checkpoint.versionId && open("versions", checkpoint.versionId)}
          empty={<p className="text-sm text-muted-foreground">No checkpoints yet.</p>}
          columns={[
            {
              key: "step",
              label: "Step",
              className: "tabular-nums",
              render: (checkpoint) => checkpoint.step,
            },
            {
              key: "metrics",
              label: "Metrics",
              render: (checkpoint) =>
                Object.entries(checkpoint.metrics)
                  .map(([metric, value]) => `${metric} ${value.toFixed(3)}`)
                  .join(" · ") || "—",
            },
            {
              key: "registered",
              label: "Version",
              render: (checkpoint) => (checkpoint.versionId ? "Registered" : "—"),
            },
            {
              key: "when",
              label: "When",
              render: (checkpoint) => formatRelativeTime(checkpoint.createdAt),
            },
          ]}
        />
      </ModelsSection>

      {run.compute && (
        <ModelsSection
          title="Modification compute"
          description="How far this run moves the model under the EU AI Act."
        >
          <ComputeMeter compute={run.compute} />
        </ModelsSection>
      )}

      <ModelsSection title="Spec" description={`Hash ${run.specHash.slice(0, 16)}`}>
        <SpecView spec={run.spec} />
      </ModelsSection>
    </div>
  );
}

export function TrainingRunView({
  workspaceId,
  runId,
  projectId,
}: {
  workspaceId: string;
  runId: string;
  projectId?: string;
}) {
  const run = useTrainingRun(workspaceId, runId);

  return (
    <ModelObjectPage
      workspaceId={workspaceId}
      projectId={projectId}
      place="training"
      placeLabel="Training"
      title={run.data?.spec.outputName}
      isLoading={run.isLoading}
      error={run.error}
    >
      <RunBody runId={runId} />
    </ModelObjectPage>
  );
}
