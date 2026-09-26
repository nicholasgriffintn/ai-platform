import { PlatformTable } from "@ngriffin_uk/polychat-component-models";
import {
  Badge,
  Button,
  ConfirmationDialog,
  FormGrid,
  FormInput,
  FormSelect,
  Switch,
} from "@ngriffin_uk/polychat-component-ui";
import {
  useAlias,
  useModelPlatformMutations,
  useModelRoutes,
} from "@ngriffin_uk/polychat-library-react";
import type { AliasDetail, AliasEvent, AliasGate } from "@ngriffin_uk/polychat-schemas";
import { formatRelativeTime } from "@ngriffin_uk/polychat-utility-core";
import { useState } from "react";

import { runWithToast } from "../../../utils/toast-action.js";
import { AliasGateFields } from "../flows/AliasGateFields.js";
import { useModelsScope } from "../ModelsScope.js";
import { ModelsSection } from "../ModelsSection.js";
import { ModelObjectPage } from "./ModelObjectPage.js";

const EVENT_LABELS: Record<AliasEvent["kind"], string> = {
  created: "Created",
  promoted: "Promoted",
  rolled_back: "Rolled back",
  canary_started: "Canary started",
  canary_ended: "Canary ended",
  requested: "Promotion requested",
  revoked: "Revoked",
};

const OUTCOME_MESSAGES = {
  promoted: "Promoted",
  canary_started: "Canary started",
  awaiting_approval: "Waiting for an approver",
  gate_failed: "Blocked by the eval gate",
} as const;

function PromotePanel({ detail }: { detail: AliasDetail }) {
  const { workspaceId, projectId } = useModelsScope();
  const routes = useModelRoutes(workspaceId, projectId);
  const mutations = useModelPlatformMutations(workspaceId);
  const [routeId, setRouteId] = useState("");
  const [canary, setCanary] = useState(0);
  const [reason, setReason] = useState("");

  return (
    <div className="space-y-4 rounded-lg border border-border p-4">
      <FormSelect
        label="Route to promote"
        value={routeId}
        onValueChange={setRouteId}
        placeholder="Pick a route"
        options={(routes.data ?? [])
          .filter((route) => route.status === "active" && route.id !== detail.alias.routeId)
          .map((route) => ({
            value: route.id,
            label: `${route.displayName} · ${route.provider}`,
          }))}
      />
      <FormGrid>
        <FormInput
          label="Canary share (%)"
          description="Leave at 0 to move all traffic at once."
          min={0}
          max={99}
          type="number"
          value={canary}
          onChange={(event) =>
            setCanary(Math.min(99, Math.max(0, Number(event.target.value) || 0)))
          }
        />
        <FormInput
          label="Reason (optional)"
          description="Recorded in the alias history."
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </FormGrid>
      <div className="flex justify-end gap-2 border-t border-border pt-3">
        <Button
          size="sm"
          variant="outline"
          disabled={mutations.rollbackAlias.isPending}
          onClick={() =>
            void runWithToast("Rolled back", () =>
              mutations.rollbackAlias.mutateAsync(detail.alias.id),
            )
          }
        >
          Roll back
        </Button>
        <Button
          size="sm"
          variant="primary"
          disabled={!routeId || mutations.promoteAlias.isPending}
          onClick={() =>
            void runWithToast(
              (result) => OUTCOME_MESSAGES[result.outcome],
              () =>
                mutations.promoteAlias.mutateAsync({
                  aliasId: detail.alias.id,
                  input: {
                    routeId,
                    ...(canary > 0 ? { canaryPercent: canary } : {}),
                    ...(reason ? { reason } : {}),
                  },
                }),
            )
          }
        >
          Promote
        </Button>
      </div>
    </div>
  );
}

function SettingsPanel({ detail }: { detail: AliasDetail }) {
  const { workspaceId } = useModelsScope();
  const mutations = useModelPlatformMutations(workspaceId);
  const [gate, setGate] = useState<AliasGate | null>(detail.alias.gate);
  const [requiresApproval, setRequiresApproval] = useState(detail.alias.requiresApproval);

  return (
    <div className="space-y-4 rounded-lg border border-border p-4">
      <AliasGateFields gate={gate} onChange={setGate} />
      <Switch
        label="Require an approver"
        description="Promotions wait for someone with approval rights."
        checked={requiresApproval}
        onChange={(event) => setRequiresApproval(event.target.checked)}
      />
      <div className="flex justify-end border-t border-border pt-3">
        <Button
          size="sm"
          variant="secondary"
          disabled={mutations.updateAlias.isPending}
          onClick={() =>
            void runWithToast("Alias updated", () =>
              mutations.updateAlias.mutateAsync({
                aliasId: detail.alias.id,
                input: { gate, requiresApproval },
              }),
            )
          }
        >
          Save changes
        </Button>
      </div>
    </div>
  );
}

function AliasBody({ detail }: { detail: AliasDetail }) {
  const { workspaceId, goTo, can } = useModelsScope();
  const mutations = useModelPlatformMutations(workspaceId);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { alias, route, canaryRoute } = detail;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-mono text-xs text-muted-foreground">{alias.chatModelId}</span>
        {alias.gate ? (
          <Badge variant="info">Eval gated</Badge>
        ) : (
          <Badge variant="outline">Ungated</Badge>
        )}
        {alias.requiresApproval && <Badge variant="warning">Approval required</Badge>}
      </div>
      <p className="text-sm text-muted-foreground">
        Pick <span className="font-mono">{alias.chatModelId}</span> as the model in chat, a teammate
        or an app to call whatever this alias serves.
      </p>

      <ModelsSection title="Serving">
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground uppercase">Primary</dt>
            <dd>
              {route
                ? `${route.provider} · ${route.providerModelId} · ${route.region}`
                : "Nothing yet"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground uppercase">Canary</dt>
            <dd>
              {canaryRoute
                ? `${alias.canaryPercent}% to ${canaryRoute.provider} · ${canaryRoute.providerModelId}`
                : "None"}
            </dd>
          </div>
        </dl>
      </ModelsSection>

      {can("promote") && (
        <ModelsSection
          title="Promote"
          description="Runs the eval gate first. A failed gate leaves traffic where it is."
        >
          <PromotePanel detail={detail} />
        </ModelsSection>
      )}

      {can("promote") && (
        <ModelsSection title="Gate and approval">
          <SettingsPanel key={alias.updatedAt} detail={detail} />
        </ModelsSection>
      )}

      <ModelsSection title="History">
        <PlatformTable
          rows={detail.events}
          rowKey={(event) => event.id}
          minWidth={560}
          empty={<p className="text-sm text-muted-foreground">No history yet.</p>}
          columns={[
            { key: "kind", label: "Event", render: (event) => EVENT_LABELS[event.kind] },
            {
              key: "gate",
              label: "Gate",
              render: (event) =>
                event.gate ? (
                  <Badge variant={event.gate.passed ? "success" : "destructive"}>
                    {event.gate.passed ? "Passed" : `Failed: ${event.gate.failures.join(", ")}`}
                  </Badge>
                ) : (
                  "—"
                ),
            },
            { key: "reason", label: "Reason", render: (event) => event.reason ?? "—" },
            { key: "when", label: "When", render: (event) => formatRelativeTime(event.createdAt) },
          ]}
        />
      </ModelsSection>

      {can("promote") && (
        <Button size="sm" variant="destructive" onClick={() => setConfirmDelete(true)}>
          Delete alias
        </Button>
      )}
      <ConfirmationDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this alias"
        description="Anything calling it will stop getting answers. Deployments and routes stay."
        confirmText="Delete"
        variant="destructive"
        onConfirm={() =>
          void runWithToast("Alias deleted", () =>
            mutations.deleteAlias.mutateAsync(alias.id),
          ).then(() => goTo("deployments"))
        }
      />
    </div>
  );
}

export function AliasView({
  workspaceId,
  aliasId,
  projectId,
}: {
  workspaceId: string;
  aliasId: string;
  projectId?: string;
}) {
  const detail = useAlias(workspaceId, aliasId);

  return (
    <ModelObjectPage
      workspaceId={workspaceId}
      projectId={projectId}
      place="deployments"
      placeLabel="Deployments"
      title={detail.data?.alias.name}
      isLoading={detail.isLoading}
      error={detail.error}
    >
      {detail.data && <AliasBody detail={detail.data} />}
    </ModelObjectPage>
  );
}
