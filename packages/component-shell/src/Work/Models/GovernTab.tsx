import {
  DecisionList,
  HuggingFaceConnectionCard,
  PolicyEditor,
  RegistryPanel,
} from "@ngriffin_uk/polychat-component-models";
import { CardSkeleton } from "@ngriffin_uk/polychat-component-ui";
import {
  useHuggingFaceConnection,
  useHuggingFaceConnectionMutations,
  useModelDecisions,
  useModelPolicies,
  useModelRegistryMutations,
} from "@ngriffin_uk/polychat-library-react";
import type {
  ModelDecision,
  ModelGovernanceEnforcement,
  PolicyDryRunResult,
  PolicyRule,
  SaveHuggingFaceConnectionRequest,
} from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import { modelVersionPath } from "./modelPaths.js";
import { ModelsSection } from "./ModelsSection.js";

export function GovernTab({
  workspaceId,
  projectId,
  projectName,
}: {
  workspaceId: string;
  projectId?: string;
  projectName?: string;
}) {
  const navigate = useNavigate();
  const policies = useModelPolicies(workspaceId);
  const pending = useModelDecisions(workspaceId, "pending", projectId);
  const recent = useModelDecisions(workspaceId, undefined, projectId);
  const mutations = useModelRegistryMutations(workspaceId);
  const huggingFace = useHuggingFaceConnection(workspaceId);
  const connection = useHuggingFaceConnectionMutations(workspaceId);
  const [dryRuns, setDryRuns] = useState<Record<string, PolicyDryRunResult>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const projectPolicy = policies.data?.projects.find((policy) => policy.projectId === projectId);

  const save = async (
    scope: string,
    rules: PolicyRule[],
    enforcement: ModelGovernanceEnforcement,
    scopeProjectId: string | null,
  ) => {
    try {
      await mutations.savePolicy.mutateAsync({ projectId: scopeProjectId, rules, enforcement });
      setDryRuns((current) => ({ ...current, [scope]: { changes: [], evaluated: 0 } }));
      toast.success("Policy revision saved");
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not save the policy"));
    }
  };

  const dryRun = async (scope: string, rules: PolicyRule[], scopeProjectId: string | null) => {
    try {
      const result = await mutations.dryRunPolicy.mutateAsync({ projectId: scopeProjectId, rules });

      setDryRuns((current) => ({ ...current, [scope]: result }));
    } catch (error) {
      toast.error(getErrorMessage(error, "Preview failed"));
    }
  };

  const resolve = async (decision: ModelDecision, state: "approved" | "rejected" | "revoked") => {
    setBusyId(decision.id);

    try {
      await mutations.resolveDecision.mutateAsync({ decisionId: decision.id, input: { state } });
      toast.success(`Decision ${state}`);
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not record the decision"));
    } finally {
      setBusyId(null);
    }
  };

  const saveConnection = async (input: SaveHuggingFaceConnectionRequest) => {
    try {
      await connection.save.mutateAsync(input);
      toast.success("Hugging Face connected");
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not save the connection"));
      throw error;
    }
  };

  const disconnect = async () => {
    try {
      await connection.disconnect.mutateAsync();
      toast.success("Hugging Face disconnected");
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not disconnect"));
    }
  };

  if (policies.isLoading || !policies.data) {
    return <CardSkeleton />;
  }

  const openVersion = (versionId: string) =>
    void navigate(modelVersionPath(workspaceId, versionId, projectId));

  return (
    <div className="space-y-8">
      <ModelsSection
        title="Review queue"
        description="Versions and routes waiting for a decision. Approvals cover exactly the issues shown here."
      >
        <DecisionList
          decisions={pending.data ?? []}
          canGovern
          busyId={busyId}
          onResolve={(decision, state) => void resolve(decision, state)}
          onOpenVersion={openVersion}
        />
      </ModelsSection>

      <ModelsSection
        title="Workspace policy"
        description="Rules every version and route in this workspace is checked against. Preview shows which verdicts would change before you save."
      >
        <PolicyEditor
          key={policies.data.workspace.hash}
          policy={policies.data.workspace}
          scopeLabel="Workspace policy"
          canEdit
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
            canEdit
            showEnforcement={false}
            isSaving={mutations.savePolicy.isPending}
            isDryRunning={mutations.dryRunPolicy.isPending}
            dryRun={dryRuns.project ?? null}
            onDryRun={(rules) => void dryRun("project", rules, projectId)}
            onSave={(rules) => void save("project", rules, "advisory", projectId)}
          />
        </ModelsSection>
      )}

      <ModelsSection
        title="Hugging Face"
        description="The account or organisation this workspace searches, trains and deploys under."
      >
        {huggingFace.data ? (
          <HuggingFaceConnectionCard
            connection={huggingFace.data}
            isSaving={connection.save.isPending}
            isDisconnecting={connection.disconnect.isPending}
            onCheck={(token) => connection.check.mutateAsync(token)}
            onSave={saveConnection}
            onDisconnect={() => void disconnect()}
          />
        ) : huggingFace.error ? (
          <RegistryPanel>
            <p className="text-sm text-failure">
              {getErrorMessage(huggingFace.error, "Could not load the Hugging Face connection")}
            </p>
          </RegistryPanel>
        ) : (
          <CardSkeleton />
        )}
      </ModelsSection>

      <ModelsSection title="Decision history" description="The 50 most recent resolved decisions.">
        <DecisionList
          decisions={(recent.data ?? [])
            .filter((decision) => decision.state !== "pending")
            .slice(0, 50)}
          canGovern
          busyId={busyId}
          onResolve={(decision, state) => void resolve(decision, state)}
          onOpenVersion={openVersion}
        />
      </ModelsSection>
    </div>
  );
}
