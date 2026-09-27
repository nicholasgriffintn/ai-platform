import {
  DeploymentOptionPicker,
  deploymentOptionKey,
  SizingPanel,
  SpecView,
} from "@ngriffin_uk/polychat-component-models";
import {
  CardSkeleton,
  FormDialog,
  FormDisclosure,
  FormGrid,
  FormInput,
  FormNotice,
  FormSection,
  FormSelect,
} from "@ngriffin_uk/polychat-component-ui";
import {
  useDeploymentPlan,
  useModelLibrary,
  useModelPlatformMutations,
} from "@ngriffin_uk/polychat-library-react";
import { QUANTISATIONS } from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import { useState } from "react";

import { runWithToast } from "../../../utils/toast-action.js";
import { useModelsScope } from "../ModelsScope.js";
import {
  createDeploymentRequest,
  type DeploymentDraft,
  deploymentDraftProblem,
  deploymentPlanRequest,
  EMPTY_DEPLOYMENT_DRAFT,
} from "./deploymentDraft.js";

export function DeployDialog({
  open,
  onOpenChange,
  initialVersionId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialVersionId?: string;
}) {
  const { workspaceId, projectId, can, open: openObject } = useModelsScope();
  const scopeProject = projectId ?? null;
  const [draft, setDraft] = useState<DeploymentDraft>({
    ...EMPTY_DEPLOYMENT_DRAFT,
    versionId: initialVersionId ?? "",
  });
  const update = (patch: Partial<DeploymentDraft>) =>
    setDraft((current) => ({ ...current, ...patch }));
  const models = useModelLibrary(workspaceId, "model", projectId);
  const adapters = useModelLibrary(workspaceId, "adapter", projectId);
  const mutations = useModelPlatformMutations(workspaceId);
  const plan = useDeploymentPlan(workspaceId, deploymentPlanRequest(draft, scopeProject));
  const option = plan.data?.options.find((item) => deploymentOptionKey(item) === draft.optionKey);
  const problem = deploymentDraftProblem(draft, option);
  const request = option ? createDeploymentRequest(draft, option, scopeProject) : null;

  const submit = async () => {
    if (!request) {
      return;
    }

    const result = await runWithToast(
      (started) =>
        started.deployment
          ? "Deployment requested. Promote its route to an alias once healthy and approved."
          : "Spend request filed for approval",
      () => mutations.createDeployment.mutateAsync(request),
    );

    if (result) {
      setDraft(EMPTY_DEPLOYMENT_DRAFT);
      onOpenChange(false);

      if (result.deployment) {
        openObject("deployments", result.deployment.id);
      }
    }
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title="Deploy a model"
      description="We size the model, then compare every host you could run it on by fit, price, jurisdiction and whether the weights are verifiably yours."
      onSubmit={submit}
      submitText="Deploy"
      isLoading={mutations.createDeployment.isPending}
      submitDisabled={problem !== null}
    >
      <div className="space-y-5">
        <FormSection title="What to serve">
          <FormGrid>
            <FormSelect
              label="Model"
              value={draft.versionId}
              onValueChange={(versionId) => update({ versionId, optionKey: null })}
              placeholder="Choose an approved model"
              options={(models.data ?? [])
                .filter((entry) => entry.usable)
                .map((entry) => ({ value: entry.version.id, label: entry.asset.displayName }))}
            />
            <FormSelect
              label="Adapter (optional)"
              value={draft.adapterVersionIds[0] ?? "none"}
              onValueChange={(value) =>
                update({ adapterVersionIds: value === "none" ? [] : [value], optionKey: null })
              }
              options={[
                { value: "none", label: "No adapter" },
                ...(adapters.data ?? [])
                  .filter((entry) => entry.usable)
                  .map((entry) => ({ value: entry.version.id, label: entry.asset.displayName })),
              ]}
            />
          </FormGrid>
          <FormGrid columns={3}>
            <FormSelect
              label="Quantisation"
              value={draft.quantisation}
              onValueChange={(quantisation) => update({ quantisation, optionKey: null })}
              options={QUANTISATIONS.map((value) => ({ value, label: value }))}
            />
            <FormInput
              label="Context length"
              type="number"
              min={512}
              value={draft.contextLength}
              onChange={(event) => update({ contextLength: Number(event.target.value) || 2048 })}
            />
            <FormInput
              label="Concurrency"
              type="number"
              min={1}
              value={draft.concurrency}
              onChange={(event) => update({ concurrency: Number(event.target.value) || 1 })}
            />
          </FormGrid>
        </FormSection>

        <FormSection
          title="Host"
          description="Hosts you can use now come first. Per-hour and per-token prices are not directly comparable, so check expected traffic."
        >
          {plan.isFetching && !plan.data ? (
            <CardSkeleton />
          ) : plan.data ? (
            <div className="space-y-3">
              {plan.data.sizing && <SizingPanel sizing={plan.data.sizing} />}
              <DeploymentOptionPicker
                options={plan.data.options}
                selectedKey={draft.optionKey}
                onSelect={(selected) => update({ optionKey: deploymentOptionKey(selected) })}
              />
            </div>
          ) : plan.error ? (
            <p className="text-sm text-failure">
              {getErrorMessage(plan.error, "Could not plan this deployment")}
            </p>
          ) : (
            <FormNotice>Choose a model to size it and compare hosts.</FormNotice>
          )}
        </FormSection>

        {option && (
          <FormSection
            title="Name and access"
            description="Clients should call the alias; promotions and rollbacks move it without touching them."
          >
            <FormGrid>
              <FormInput
                label="Deployment name"
                placeholder="support-7b"
                description="Lowercase letters, digits and dashes."
                value={draft.name}
                onChange={(event) => update({ name: event.target.value })}
              />
              {can("promote") && (
                <FormInput
                  label="Alias (optional)"
                  placeholder="support"
                  description="Creates an empty alias. Promote the deployment once healthy and approved."
                  value={draft.aliasName}
                  onChange={(event) => update({ aliasName: event.target.value })}
                />
              )}
            </FormGrid>
            {option.shape === "dedicated" && (
              <FormGrid>
                <FormInput
                  label="Minimum replicas"
                  type="number"
                  min={0}
                  description={option.scaleToZero ? "Zero lets it sleep when idle." : undefined}
                  value={draft.minReplicas}
                  onChange={(event) =>
                    update({ minReplicas: Math.max(0, Number(event.target.value) || 0) })
                  }
                />
                <FormInput
                  label="Maximum replicas"
                  type="number"
                  min={1}
                  value={draft.maxReplicas}
                  onChange={(event) =>
                    update({ maxReplicas: Math.max(1, Number(event.target.value) || 1) })
                  }
                />
              </FormGrid>
            )}
            {option.shape === "external" && (
              <FormGrid>
                <FormInput
                  label="Base URL"
                  placeholder="https://models.example.com/v1"
                  value={draft.externalBaseUrl}
                  onChange={(event) => update({ externalBaseUrl: event.target.value })}
                />
                <FormInput
                  label="Model ID"
                  value={draft.externalModelId}
                  onChange={(event) => update({ externalModelId: event.target.value })}
                />
              </FormGrid>
            )}
            {problem && <p className="text-xs text-muted-foreground">{problem}</p>}
            {request && (
              <FormDisclosure title="Spec" summary="What will be recorded">
                <SpecView spec={request.spec} />
              </FormDisclosure>
            )}
          </FormSection>
        )}
      </div>
    </FormDialog>
  );
}
