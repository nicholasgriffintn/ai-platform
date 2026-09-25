import {
  BuildList,
  HuggingFaceWriteHint,
  RegistryPanel,
} from "@ngriffin_uk/polychat-component-models";
import {
  Button,
  CardSkeleton,
  ContentLoadingSkeleton,
  FormInput,
  FormSelect,
} from "@ngriffin_uk/polychat-component-ui";
import {
  useHuggingFaceConnection,
  useModelBuilds,
  useModelLibrary,
  useModelRegistryMutations,
} from "@ngriffin_uk/polychat-library-react";
import { getErrorMessage, isGitCommitSha, shortenHash } from "@ngriffin_uk/polychat-utility-core";
import { lazy, Suspense, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import { modelVersionPath } from "./modelPaths.js";
import { ModelsSection } from "./ModelsSection.js";

const TrainingDashboard = lazy(async () => {
  const module = await import("../../Apps/Training/TrainingDashboard.js");

  return { default: module.TrainingDashboard };
});

const RECIPE_OPTIONS = [
  { value: "sft-lora", label: "LoRA fine-tune (adapter merged into the base)" },
  { value: "sft-full", label: "Full fine-tune (every weight changes)" },
] as const;

const FLAVOR_OPTIONS = [
  { value: "a10g-large", label: "A10G large (24 GB)" },
  { value: "l40sx1", label: "L40S (48 GB)" },
  { value: "a100-large", label: "A100 (80 GB)" },
  { value: "h200", label: "H200 (141 GB)" },
] as const;

export function BuildTab({ workspaceId, projectId }: { workspaceId: string; projectId?: string }) {
  const navigate = useNavigate();
  const library = useModelLibrary(workspaceId, projectId);
  const builds = useModelBuilds(workspaceId, projectId);
  const mutations = useModelRegistryMutations(workspaceId);
  const canTrain = useHuggingFaceConnection(workspaceId).data?.canTrainAndDeploy ?? false;
  const [baseVersionId, setBaseVersionId] = useState("");
  const [recipe, setRecipe] = useState<(typeof RECIPE_OPTIONS)[number]["value"]>("sft-lora");
  const [flavor, setFlavor] = useState<(typeof FLAVOR_OPTIONS)[number]["value"]>("a10g-large");
  const [epochs, setEpochs] = useState("2");
  const [minRating, setMinRating] = useState("4");
  const [showProviderJobs, setShowProviderJobs] = useState(false);
  const bases = (library.data ?? []).filter(
    (entry) =>
      entry.asset.kind === "model" && entry.usable && isGitCommitSha(entry.version.revision),
  );
  const names = Object.fromEntries(
    (library.data ?? []).map((entry) => [
      entry.version.id,
      `${entry.asset.displayName}@${shortenHash(entry.version.revision)}`,
    ]),
  );

  const start = async () => {
    try {
      await mutations.startBuild.mutateAsync({
        projectId: projectId ?? null,
        baseVersionId,
        recipe,
        flavor,
        epochs: Number(epochs) || 2,
        minFeedbackRating: Number(minRating) || undefined,
        exampleLimit: 1000,
      });
      toast.success("Training started. The output lands as a draft version for review.");
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not start training"));
    }
  };

  if (library.isLoading) {
    return <CardSkeleton />;
  }

  return (
    <div className="space-y-8">
      <ModelsSection
        title="New fine-tune"
        description="Your rated conversations become a governed dataset version first. Personal data in the sample sends it to review before any training runs."
      >
        <RegistryPanel>
          {bases.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Only approved Hub models can be a base. Import one and get it approved first.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <FormSelect
                label="Base model"
                options={bases.map((entry) => ({
                  value: entry.version.id,
                  label: names[entry.version.id],
                }))}
                value={baseVersionId}
                onValueChange={setBaseVersionId}
                placeholder="Choose an approved version"
              />
              <FormSelect
                label="Recipe"
                options={RECIPE_OPTIONS}
                value={recipe}
                onValueChange={setRecipe}
              />
              <FormSelect
                label="Hardware"
                options={FLAVOR_OPTIONS}
                value={flavor}
                onValueChange={setFlavor}
              />
              <FormInput
                label="Epochs"
                type="number"
                min={1}
                max={20}
                value={epochs}
                onChange={(event) => setEpochs(event.target.value)}
              />
              <FormInput
                label="Minimum feedback rating"
                description="Only conversations rated at or above this are used."
                type="number"
                min={1}
                max={5}
                value={minRating}
                onChange={(event) => setMinRating(event.target.value)}
              />
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
            <Button
              variant="primary"
              size="sm"
              disabled={!canTrain || !baseVersionId || mutations.startBuild.isPending}
              onClick={() => void start()}
            >
              {mutations.startBuild.isPending ? "Starting…" : "Start training"}
            </Button>
            {!canTrain && <HuggingFaceWriteHint action="Fine-tuning" />}
          </div>
        </RegistryPanel>
      </ModelsSection>

      <ModelsSection
        title="Builds"
        description="Each finished build lands as a draft version for review."
      >
        <BuildList
          builds={builds.data ?? []}
          names={names}
          onOpenVersion={(versionId) =>
            void navigate(modelVersionPath(workspaceId, versionId, projectId))
          }
        />
      </ModelsSection>

      <ModelsSection
        title="Provider jobs"
        description="SageMaker and Bedrock jobs run outside the registry."
        actions={
          <Button variant="ghost" size="sm" onClick={() => setShowProviderJobs((value) => !value)}>
            {showProviderJobs ? "Hide" : "Show"}
          </Button>
        }
      >
        {showProviderJobs && (
          <Suspense fallback={<ContentLoadingSkeleton />}>
            <TrainingDashboard />
          </Suspense>
        )}
      </ModelsSection>
    </div>
  );
}
