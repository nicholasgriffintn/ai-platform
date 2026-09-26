import {
  ADAPTATION_LABELS,
  ComputeMeter,
  SpecView,
  SpendPreflightNotice,
  TRAINING_METHOD_LABELS,
  TrainerOptionPicker,
  trainerOptionKey,
  VerdictBadge,
} from "@ngriffin_uk/polychat-component-models";
import {
  Button,
  CardSkeleton,
  FormDialog,
  FormDisclosure,
  FormGrid,
  FormInput,
  FormNotice,
  FormSection,
  FormSelect,
  FormTextarea,
} from "@ngriffin_uk/polychat-component-ui";
import {
  useDatasets,
  useGraders,
  useModelLibrary,
  useModelPlatformMutations,
  useTrainingPlan,
} from "@ngriffin_uk/polychat-library-react";
import { ADAPTATIONS, TRAINING_METHODS } from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import { Sparkles } from "lucide-react";
import { useState } from "react";

import { runWithToast } from "../../../utils/toast-action.js";
import { useModelsScope } from "../ModelsScope.js";
import {
  applyRecommendation,
  EMPTY_TRAINING_DRAFT,
  needsDataset,
  startRunRequest,
  type TrainingDraft,
  trainingPlanRequest,
} from "./trainingDraft.js";

const OUTPUT_NAME = /^[a-z0-9][a-z0-9-]{2,63}$/;

export function TrainDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { workspaceId, projectId, open: openObject } = useModelsScope();
  const scopeProject = projectId ?? null;
  const [draft, setDraft] = useState<TrainingDraft>(EMPTY_TRAINING_DRAFT);
  const [reasons, setReasons] = useState<string[]>([]);
  const update = (patch: Partial<TrainingDraft>) =>
    setDraft((current) => ({ ...current, ...patch }));
  const bases = useModelLibrary(workspaceId, "model", projectId);
  const datasets = useDatasets(workspaceId, projectId);
  const graders = useGraders(workspaceId, projectId);
  const mutations = useModelPlatformMutations(workspaceId);
  const plan = useTrainingPlan(workspaceId, trainingPlanRequest(draft, scopeProject));
  const option = plan.data?.options.find((item) => trainerOptionKey(item) === draft.optionKey);
  const request = option ? startRunRequest(draft, option, scopeProject) : null;
  const blocked =
    plan.data?.preflight.decision === "blocked" || plan.data?.verdicts.base.effect === "block";
  const datasetNeeded = needsDataset(draft.method);

  const recommend = async () => {
    try {
      const recommendation = await mutations.recommendTraining.mutateAsync({
        projectId: scopeProject,
        goal: draft.goal,
        datasetVersionId: draft.datasetVersionId || null,
        graderId: draft.graderId || null,
      });

      setDraft((current) => applyRecommendation(current, recommendation));
      setReasons(recommendation.reasons);
    } catch (error) {
      setReasons([getErrorMessage(error, "No suggestion for this goal yet.")]);
    }
  };

  const submit = async () => {
    if (!request) {
      return;
    }

    const result = await runWithToast(
      (started) => (started.run ? "Training run started" : "Spend request filed for approval"),
      () => mutations.startRun.mutateAsync(request),
    );

    if (result) {
      setDraft(EMPTY_TRAINING_DRAFT);
      setReasons([]);
      onOpenChange(false);

      if (result.run) {
        openObject("runs", result.run.id);
      }
    }
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title="Train a model"
      description="Describe the goal and we suggest a method, base and trainer. Everything is recorded as a spec you can read before it starts."
      onSubmit={submit}
      submitText={
        plan.data?.preflight.decision === "needs_approval" ? "Ask for approval" : "Start training"
      }
      isLoading={mutations.startRun.isPending}
      submitDisabled={!request || blocked || !OUTPUT_NAME.test(draft.outputName)}
    >
      <div className="space-y-5">
        <FormSection
          title="Goal"
          description="Optional, but it lets us suggest a sensible setup."
          actions={
            <Button
              size="sm"
              variant="secondary"
              icon={<Sparkles size={14} />}
              disabled={!draft.goal.trim()}
              isLoading={mutations.recommendTraining.isPending}
              onClick={() => void recommend()}
            >
              Suggest a setup
            </Button>
          }
        >
          <FormTextarea
            label="What should it get better at?"
            placeholder="Answer support questions in our tone, cite the help centre and refuse refunds over £500."
            value={draft.goal}
            onChange={(event) => update({ goal: event.target.value })}
          />
          {reasons.length > 0 && (
            <ul className="list-disc space-y-1 rounded-md bg-muted/40 py-2 pr-3 pl-7 text-xs text-muted-foreground">
              {reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          )}
        </FormSection>

        <FormSection title="Model and data">
          <FormGrid>
            <FormSelect
              label="Method"
              value={draft.method}
              onValueChange={(method) => update({ method, optionKey: null })}
              options={TRAINING_METHODS.map((method) => ({
                value: method,
                label: TRAINING_METHOD_LABELS[method],
              }))}
            />
            <FormSelect
              label="Adaptation"
              value={draft.adaptation}
              onValueChange={(adaptation) => update({ adaptation, optionKey: null })}
              options={ADAPTATIONS.map((adaptation) => ({
                value: adaptation,
                label: ADAPTATION_LABELS[adaptation],
              }))}
            />
            <FormSelect
              label="Base model"
              value={draft.baseVersionId}
              onValueChange={(baseVersionId) => update({ baseVersionId, optionKey: null })}
              placeholder="Choose an approved model"
              options={(bases.data ?? [])
                .filter((entry) => entry.usable)
                .map((entry) => ({ value: entry.version.id, label: entry.asset.displayName }))}
            />
            <FormSelect
              label={datasetNeeded ? "Dataset" : "Dataset (not used)"}
              value={draft.datasetVersionId}
              disabled={!datasetNeeded}
              onValueChange={(datasetVersionId) => update({ datasetVersionId, optionKey: null })}
              placeholder="Choose a governed dataset"
              options={(datasets.data ?? [])
                .filter((dataset) => dataset.usable)
                .map((dataset) => ({ value: dataset.versionId, label: dataset.name }))}
            />
            <FormSelect
              label={draft.method === "rft" ? "Grader" : "Grader (optional)"}
              value={draft.graderId}
              onValueChange={(graderId) => update({ graderId, optionKey: null })}
              placeholder="Choose a grader"
              options={(graders.data ?? []).map((grader) => ({
                value: grader.id,
                label: grader.name,
              }))}
            />
            <FormInput
              label="Output name"
              placeholder="support-tone-v1"
              description="Lowercase letters, digits and dashes."
              value={draft.outputName}
              onChange={(event) => update({ outputName: event.target.value })}
            />
          </FormGrid>
          <FormDisclosure
            title="Hyperparameters"
            summary={`${draft.epochs} epochs · rank ${draft.loraRank} · lr ${draft.learningRate || "auto"}`}
          >
            <FormGrid columns={3}>
              <FormInput
                label="Epochs"
                type="number"
                min={1}
                value={draft.epochs}
                onChange={(event) => update({ epochs: Number(event.target.value) || 1 })}
              />
              <FormInput
                label="Learning rate"
                placeholder="auto"
                value={draft.learningRate}
                onChange={(event) => update({ learningRate: event.target.value })}
              />
              <FormInput
                label="LoRA rank"
                type="number"
                min={1}
                value={draft.loraRank}
                onChange={(event) => update({ loraRank: Number(event.target.value) || 8 })}
              />
            </FormGrid>
          </FormDisclosure>
        </FormSection>

        <FormSection
          title="Trainer"
          description="Every trainer you could use, ranked by what it would cost you."
        >
          {plan.isFetching && !plan.data ? (
            <CardSkeleton />
          ) : plan.data ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>Base</span>
                <VerdictBadge effect={plan.data.verdicts.base.effect} />
                {plan.data.verdicts.dataset && (
                  <>
                    <span>Dataset</span>
                    <VerdictBadge effect={plan.data.verdicts.dataset.effect} />
                  </>
                )}
                {plan.data.tokens !== null && (
                  <span className="ml-auto">
                    ≈ {Math.round(plan.data.tokens).toLocaleString("en-GB")} training tokens
                  </span>
                )}
              </div>
              <TrainerOptionPicker
                options={plan.data.options}
                selectedKey={draft.optionKey}
                onSelect={(selected) =>
                  update({
                    optionKey: trainerOptionKey(selected),
                    hardware: selected.hardware[0]?.id ?? null,
                    region: selected.regions[0]?.id ?? null,
                  })
                }
              />
              {option && (option.hardware.length > 1 || option.regions.length > 1) && (
                <FormGrid>
                  {option.hardware.length > 1 && (
                    <FormSelect
                      label="Hardware"
                      value={draft.hardware ?? ""}
                      onValueChange={(hardware) => update({ hardware })}
                      options={option.hardware.map((item) => ({
                        value: item.id,
                        label: item.label,
                      }))}
                    />
                  )}
                  {option.regions.length > 1 && (
                    <FormSelect
                      label="Region"
                      value={draft.region ?? ""}
                      onValueChange={(region) => update({ region })}
                      options={option.regions.map((item) => ({
                        value: item.id,
                        label: `${item.label} (${item.jurisdiction.toUpperCase()})`,
                      }))}
                    />
                  )}
                </FormGrid>
              )}
              {plan.data.compute && <ComputeMeter compute={plan.data.compute} />}
              <SpendPreflightNotice preflight={plan.data.preflight} />
              {request && (
                <FormDisclosure title="Spec" summary="What will be recorded">
                  <SpecView spec={request.spec} />
                </FormDisclosure>
              )}
            </div>
          ) : plan.error ? (
            <p className="text-sm text-failure">
              {getErrorMessage(plan.error, "Could not plan this run")}
            </p>
          ) : (
            <FormNotice>
              Choose a base model{datasetNeeded ? " and a dataset" : ""} to compare trainers.
            </FormNotice>
          )}
        </FormSection>
      </div>
    </FormDialog>
  );
}
