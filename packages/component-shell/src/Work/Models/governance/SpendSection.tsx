import { SpendRequestList, SpendSummaryPanel } from "@ngriffin_uk/polychat-component-models";
import {
  Button,
  CardSkeleton,
  FormDialog,
  FormGrid,
  FormInput,
  FormSection,
  Switch,
} from "@ngriffin_uk/polychat-component-ui";
import {
  useModelPlatformMutations,
  useModelSpend,
  useSpendRequests,
} from "@ngriffin_uk/polychat-library-react";
import type { ModelBudget } from "@ngriffin_uk/polychat-schemas";
import { formatUsd } from "@ngriffin_uk/polychat-utility-core";
import { useState } from "react";

import { runWithToast } from "../../../utils/toast-action.js";
import { useModelsScope } from "../ModelsScope.js";
import { ModelsSection } from "../ModelsSection.js";

function BudgetDialog({ budget, onClose }: { budget: ModelBudget | null; onClose: () => void }) {
  const { workspaceId, projectId } = useModelsScope();
  const mutations = useModelPlatformMutations(workspaceId);
  const [limit, setLimit] = useState(budget?.monthlyLimitUsd ?? 500);
  const [softPercent, setSoftPercent] = useState(budget?.softLimitPercent ?? 80);
  const [hardStop, setHardStop] = useState(budget?.hardStop ?? true);
  const [approvalAbove, setApprovalAbove] = useState(
    budget?.approvalAboveUsd === null || !budget ? "" : String(budget.approvalAboveUsd),
  );
  const [idleMinutes, setIdleMinutes] = useState(
    budget?.idlePauseMinutes === null || !budget ? "" : String(budget.idlePauseMinutes),
  );

  const submit = async () => {
    const saved = await runWithToast("Budget saved", () =>
      mutations.saveBudget.mutateAsync({
        projectId: projectId ?? null,
        monthlyLimitUsd: limit,
        softLimitPercent: softPercent,
        hardStop,
        approvalAboveUsd: approvalAbove ? Number(approvalAbove) : null,
        idlePauseMinutes: idleMinutes ? Number(idleMinutes) : null,
      }),
    );

    if (saved) {
      onClose();
    }
  };

  return (
    <FormDialog
      open
      onOpenChange={(value) => !value && onClose()}
      title={projectId ? "Project budget" : "Workspace budget"}
      description="Checked before every run and deployment starts, and again every quarter of an hour while they run."
      onSubmit={submit}
      submitText="Save budget"
      isLoading={mutations.saveBudget.isPending}
    >
      <div className="space-y-5">
        <FormSection title="Limit">
          <FormGrid>
            <FormInput
              label="Monthly limit (USD)"
              type="number"
              min={0}
              value={limit}
              onChange={(event) => setLimit(Math.max(0, Number(event.target.value) || 0))}
            />
            <FormInput
              label="Warn at (%)"
              type="number"
              min={1}
              max={100}
              value={softPercent}
              onChange={(event) =>
                setSoftPercent(Math.min(100, Math.max(1, Number(event.target.value) || 80)))
              }
            />
          </FormGrid>
          <Switch
            label="Hard stop"
            description="Refuse new starts at the limit and pause running deployments."
            checked={hardStop}
            onChange={(event) => setHardStop(event.target.checked)}
          />
        </FormSection>
        <FormSection title="Guardrails">
          <FormGrid>
            <FormInput
              label="Approval above (USD)"
              placeholder="Never"
              description="Starts estimated above this wait for an approver."
              value={approvalAbove}
              onChange={(event) => setApprovalAbove(event.target.value.replace(/[^\d.]/g, ""))}
            />
            <FormInput
              label="Pause when idle (minutes)"
              placeholder="Never"
              description="Deployments with no traffic for this long are paused."
              value={idleMinutes}
              onChange={(event) => setIdleMinutes(event.target.value.replace(/\D/g, ""))}
            />
          </FormGrid>
        </FormSection>
      </div>
    </FormDialog>
  );
}

export function SpendSection() {
  const { workspaceId, projectId, can } = useModelsScope();
  const spend = useModelSpend(workspaceId);
  const requests = useSpendRequests(workspaceId);
  const mutations = useModelPlatformMutations(workspaceId);
  const [editing, setEditing] = useState(false);
  const budget = spend.data?.budgets.find((item) => item.projectId === (projectId ?? null)) ?? null;

  return (
    <>
      <ModelsSection
        title="Spend and budgets"
        description={
          budget
            ? `Limit ${formatUsd(budget.monthlyLimitUsd)} a month${budget.hardStop ? ", hard stop" : ""}.`
            : "No budget set here."
        }
        actions={
          can("manage_budgets") && (
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
                {budget ? "Edit budget" : "Set a budget"}
              </Button>
              {budget && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    void runWithToast("Budget removed", () =>
                      mutations.deleteBudget.mutateAsync(projectId),
                    )
                  }
                >
                  Remove
                </Button>
              )}
            </div>
          )
        }
      >
        {spend.data ? <SpendSummaryPanel spend={spend.data} /> : <CardSkeleton />}
      </ModelsSection>
      <ModelsSection
        title="Spend requests"
        description="Runs and deployments over the approval threshold wait here."
      >
        <SpendRequestList
          requests={requests.data ?? []}
          canResolve={can("approve")}
          onResolve={(request, state) =>
            void runWithToast(state === "approved" ? "Approved and started" : "Rejected", () =>
              mutations.resolveSpend.mutateAsync({ requestId: request.id, input: { state } }),
            )
          }
        />
      </ModelsSection>
      {editing && (
        <BudgetDialog key={budget?.id ?? "new"} budget={budget} onClose={() => setEditing(false)} />
      )}
    </>
  );
}
