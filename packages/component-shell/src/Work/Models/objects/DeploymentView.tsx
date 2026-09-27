import {
  DEPLOYMENT_SHAPE_LABELS,
  DeploymentStatusBadge,
  SpecView,
  StatTile,
} from "@ngriffin_uk/polychat-component-models";
import {
  Badge,
  Button,
  ConfirmationDialog,
  FormGrid,
  FormInput,
  FormTextarea,
} from "@ngriffin_uk/polychat-component-ui";
import { useDeployment, useModelPlatformMutations } from "@ngriffin_uk/polychat-library-react";
import type { DeploymentDetail, PlaygroundResponse } from "@ngriffin_uk/polychat-schemas";
import {
  formatCompactCount,
  formatRelativeTime,
  formatUsd,
} from "@ngriffin_uk/polychat-utility-core";
import { useState } from "react";

import { runWithToast } from "../../../utils/toast-action.js";
import { useModelsScope } from "../ModelsScope.js";
import { ModelsSection } from "../ModelsSection.js";
import { ModelObjectPage } from "./ModelObjectPage.js";

function Playground({ deploymentId }: { deploymentId: string }) {
  const { workspaceId } = useModelsScope();
  const mutations = useModelPlatformMutations(workspaceId);
  const [prompt, setPrompt] = useState("");
  const [reply, setReply] = useState<PlaygroundResponse | null>(null);

  const send = async () => {
    const result = await runWithToast("Answered", () =>
      mutations.playground.mutateAsync({
        deploymentId,
        input: { messages: [{ role: "user", content: prompt }] },
      }),
    );

    if (result) {
      setReply(result);
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <FormTextarea
        label="Prompt"
        placeholder="Ask it something your users would."
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
      />
      <div className="flex justify-end">
        <Button
          size="sm"
          variant="secondary"
          disabled={!prompt.trim() || mutations.playground.isPending}
          onClick={() => void send()}
        >
          Send
        </Button>
      </div>
      {reply && (
        <div className="space-y-1 rounded-lg border border-border p-3 text-sm">
          <p className="whitespace-pre-wrap">{reply.output}</p>
          <p className="text-xs text-muted-foreground">
            {(reply.latencyMs / 1000).toFixed(1)}s · {reply.inputTokens} in · {reply.outputTokens}{" "}
            out
          </p>
        </div>
      )}
    </div>
  );
}

function ScaleControls({ detail }: { detail: DeploymentDetail }) {
  const { workspaceId } = useModelsScope();
  const mutations = useModelPlatformMutations(workspaceId);
  const [min, setMin] = useState(detail.deployment.spec.scaling.minReplicas);
  const [max, setMax] = useState(detail.deployment.spec.scaling.maxReplicas);

  return (
    <div className="space-y-4 rounded-lg border border-border p-4">
      <FormGrid>
        <FormInput
          label="Minimum replicas"
          min={0}
          type="number"
          value={min}
          onChange={(event) => setMin(Math.max(0, Number(event.target.value) || 0))}
        />
        <FormInput
          label="Maximum replicas"
          min={1}
          type="number"
          value={max}
          onChange={(event) => setMax(Math.max(1, Number(event.target.value) || 1))}
        />
      </FormGrid>
      <div className="flex justify-end border-t border-border pt-3">
        <Button
          size="sm"
          variant="secondary"
          disabled={min > max || mutations.scaleDeployment.isPending}
          onClick={() =>
            void runWithToast(
              (result) => (result.spendRequestId ? "Spend approval requested" : "Scaling updated"),
              () =>
                mutations.scaleDeployment.mutateAsync({
                  deploymentId: detail.deployment.id,
                  input: { minReplicas: min, maxReplicas: max },
                }),
            )
          }
        >
          Apply scaling
        </Button>
      </div>
    </div>
  );
}

function DeploymentBody({ detail }: { detail: DeploymentDetail }) {
  const { workspaceId, open, can } = useModelsScope();
  const mutations = useModelPlatformMutations(workspaceId);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { deployment } = detail;
  const change = (action: "pause" | "resume" | "delete") =>
    runWithToast(
      (result) =>
        result.spendRequestId
          ? "Spend approval requested"
          : `Deployment ${action === "delete" ? "deleting" : action === "pause" ? "paused" : "resuming"}`,
      () => mutations.changeDeployment.mutateAsync({ deploymentId: deployment.id, action }),
    );
  const serving = deployment.status === "running" || deployment.status === "scaled_to_zero";

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-2">
        <DeploymentStatusBadge status={deployment.status} />
        <Badge variant="outline">{DEPLOYMENT_SHAPE_LABELS[deployment.spec.shape]}</Badge>
        {deployment.jurisdiction && (
          <Badge variant="outline">{deployment.jurisdiction.toUpperCase()}</Badge>
        )}
        <Badge variant={deployment.weightsVerified ? "success" : "outline"}>
          {deployment.weightsVerified ? "Weights verified" : "Weights by name"}
        </Badge>
        <span className="text-xs text-muted-foreground">
          {deployment.provider} · {deployment.host}
          {deployment.region ? ` · ${deployment.region}` : ""}
        </span>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => open("versions", deployment.spec.versionId)}
        >
          Open the model
        </Button>
      </div>
      {deployment.failureReason && (
        <p className="text-sm text-failure">{deployment.failureReason}</p>
      )}
      {can("deploy") && (
        <div className="flex flex-wrap gap-2">
          {deployment.status === "paused" ? (
            <Button size="sm" variant="secondary" onClick={() => void change("resume")}>
              Resume
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              disabled={
                !serving ||
                deployment.pauseSupported === false ||
                mutations.changeDeployment.isPending
              }
              onClick={() => void change("pause")}
            >
              Pause
            </Button>
          )}
          <Button size="sm" variant="destructive" onClick={() => setConfirmDelete(true)}>
            Delete
          </Button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile
          label="Requests"
          value={formatCompactCount(detail.health.requests)}
          detail="last 14 days"
        />
        <StatTile
          label="Tokens"
          value={formatCompactCount(detail.health.inputTokens + detail.health.outputTokens)}
          detail={`${formatCompactCount(detail.health.inputTokens)} in · ${formatCompactCount(detail.health.outputTokens)} out`}
        />
        <StatTile label="Hourly" value={formatUsd(deployment.hourlyUsd)} />
        <StatTile
          label="Spent"
          value={formatUsd(detail.spendUsd)}
          detail={
            deployment.lastCheckedAt
              ? `checked ${formatRelativeTime(deployment.lastCheckedAt)}`
              : undefined
          }
        />
      </div>

      {serving && (
        <ModelsSection
          title="Playground"
          description="Talk to the deployment directly, outside any alias."
        >
          <Playground deploymentId={deployment.id} />
        </ModelsSection>
      )}

      {deployment.spec.shape === "dedicated" && can("deploy") && (
        <ModelsSection
          title="Scaling"
          description="A minimum of zero lets the host sleep when idle, where it supports it."
        >
          <ScaleControls key={deployment.specHash} detail={detail} />
        </ModelsSection>
      )}

      <ModelsSection title="Aliases" description="Names that currently send traffic here.">
        {detail.aliases.length === 0 ? (
          <p className="text-sm text-muted-foreground">No alias points here yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {detail.aliases.map((alias) => (
              <Button
                key={alias.id}
                size="sm"
                variant="outline"
                onClick={() => open("aliases", alias.id)}
              >
                {alias.name}
              </Button>
            ))}
          </div>
        )}
      </ModelsSection>

      <ModelsSection title="Spec" description={`Hash ${deployment.specHash.slice(0, 16)}`}>
        <SpecView spec={deployment.spec} />
      </ModelsSection>

      <ConfirmationDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this deployment"
        description="The provider resource is removed and its route retired. Aliases pointing here stop serving."
        confirmText="Delete"
        variant="destructive"
        onConfirm={() => void change("delete").then(() => setConfirmDelete(false))}
      />
    </div>
  );
}

export function DeploymentView({
  workspaceId,
  deploymentId,
  projectId,
}: {
  workspaceId: string;
  deploymentId: string;
  projectId?: string;
}) {
  const detail = useDeployment(workspaceId, deploymentId);

  return (
    <ModelObjectPage
      workspaceId={workspaceId}
      projectId={projectId}
      place="deployments"
      placeLabel="Deployments"
      title={detail.data?.deployment.name}
      isLoading={detail.isLoading}
      error={detail.error}
    >
      {detail.data && <DeploymentBody detail={detail.data} />}
    </ModelObjectPage>
  );
}
