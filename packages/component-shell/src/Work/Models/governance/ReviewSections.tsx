import { DecisionList, PolicyEditor } from "@ngriffin_uk/polychat-component-models";
import { CardSkeleton } from "@ngriffin_uk/polychat-component-ui";
import {
  useModelDecisions,
  useModelPlatformMutations,
  useModelPolicies,
} from "@ngriffin_uk/polychat-library-react";
import type {
  ModelDecision,
  ModelGovernanceEnforcement,
  PolicyDryRunResult,
  PolicyRule,
} from "@ngriffin_uk/polychat-schemas";
import { useState } from "react";

import { runWithToast } from "../../../utils/toast-action.js";
import { useModelsScope } from "../ModelsScope.js";
import { ModelsSection } from "../ModelsSection.js";

export function DecisionSections() {
  const { workspaceId, projectId, can, open } = useModelsScope();
  const pending = useModelDecisions(workspaceId, "pending", projectId);
  const recent = useModelDecisions(workspaceId, undefined, projectId);
  const mutations = useModelPlatformMutations(workspaceId);
  const [busyId, setBusyId] = useState<string | null>(null);

  const resolve = async (decision: ModelDecision, state: "approved" | "rejected" | "revoked") => {
    setBusyId(decision.id);
    await runWithToast(`Decision ${state}`, () =>
      mutations.resolveDecision.mutateAsync({ decisionId: decision.id, input: { state } }),
    );
    setBusyId(null);
  };

  return (
    <>
      <ModelsSection
        title="Review queue"
        description="Versions and routes waiting for a decision. Approvals cover exactly the issues shown here."
      >
        <DecisionList
          decisions={pending.data ?? []}
          canGovern={can("approve")}
          busyId={busyId}
          onResolve={(decision, state) => void resolve(decision, state)}
          onOpenVersion={(versionId) => open("versions", versionId)}
        />
      </ModelsSection>
      <ModelsSection title="Decision history" description="The 50 most recent resolved decisions.">
        <DecisionList
          decisions={(recent.data ?? [])
            .filter((decision) => decision.state !== "pending")
            .slice(0, 50)}
          canGovern={can("approve")}
          busyId={busyId}
          onResolve={(decision, state) => void resolve(decision, state)}
          onOpenVersion={(versionId) => open("versions", versionId)}
        />
      </ModelsSection>
    </>
  );
}

export function PolicySections({ projectName }: { projectName?: string }) {
  const { workspaceId, projectId, can } = useModelsScope();
  const policies = useModelPolicies(workspaceId);
  const mutations = useModelPlatformMutations(workspaceId);
  const [dryRuns, setDryRuns] = useState<Record<string, PolicyDryRunResult>>({});
  const canEdit = can("manage_policy");

  const save = (
    scope: string,
    rules: PolicyRule[],
    enforcement: ModelGovernanceEnforcement,
    scopeProjectId: string | null,
  ) =>
    runWithToast("Policy revision saved", async () => {
      await mutations.savePolicy.mutateAsync({ projectId: scopeProjectId, rules, enforcement });
      setDryRuns((current) => ({ ...current, [scope]: { changes: [], evaluated: 0 } }));
    });

  const dryRun = (scope: string, rules: PolicyRule[], scopeProjectId: string | null) =>
    runWithToast("Preview ready", async () => {
      const result = await mutations.dryRunPolicy.mutateAsync({ projectId: scopeProjectId, rules });

      setDryRuns((current) => ({ ...current, [scope]: result }));
    });

  if (!policies.data) {
    return <CardSkeleton />;
  }

  const projectPolicy = policies.data.projects.find((policy) => policy.projectId === projectId);

  return (
    <>
      <ModelsSection
        title="Workspace policy"
        description="Rules every version, dataset and route is checked against, including jurisdiction, retention, lawful basis and teacher terms."
      >
        <PolicyEditor
          key={policies.data.workspace.hash}
          policy={policies.data.workspace}
          scopeLabel="Workspace policy"
          canEdit={canEdit}
          showEnforcement
          isSaving={mutations.savePolicy.isPending}
          isDryRunning={mutations.dryRunPolicy.isPending}
          dryRun={dryRuns.workspace ?? null}
          onDryRun={(rules) => void dryRun("workspace", rules, null)}
          onSave={(rules, enforcement) => void save("workspace", rules, enforcement, null)}
        />
      </ModelsSection>
      {projectId && (
        <ModelsSection
          title={`${projectName ?? "Project"} policy`}
          description="Extra rules for this project. They can only narrow the workspace policy."
        >
          <PolicyEditor
            key={projectPolicy?.hash ?? "new"}
            policy={
              projectPolicy ?? {
                ...policies.data.workspace,
                id: `new:${projectId}`,
                projectId,
                rules: [],
                revision: 0,
                isDefault: true,
              }
            }
            scopeLabel={`${projectName ?? "Project"} policy`}
            canEdit={canEdit}
            showEnforcement={false}
            isSaving={mutations.savePolicy.isPending}
            isDryRunning={mutations.dryRunPolicy.isPending}
            dryRun={dryRuns.project ?? null}
            onDryRun={(rules) => void dryRun("project", rules, projectId)}
            onSave={(rules) => void save("project", rules, "advisory", projectId)}
          />
        </ModelsSection>
      )}
    </>
  );
}
