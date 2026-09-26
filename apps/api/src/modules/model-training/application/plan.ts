import { listProviderManifests } from "@ngriffin_uk/polychat-ai-model-providers";
import {
  assessModificationCompute,
  estimateTrainingFlops,
  recommendTraining,
  resolveTrainerOptions,
  trainingTokens,
} from "@ngriffin_uk/polychat-library-model-registry";
import {
  type DatasetShape,
  type DatasetStats,
  type GraderKind,
  type ModificationCompute,
  type TrainingMethod,
  type TrainingPlan,
  type TrainingPlanRequest,
  trainingPlanRequestSchema,
  type TrainingRecommendation,
  type TrainingRecommendationRequest,
  trainingRecommendationRequestSchema,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { RepositoryManager } from "~/infrastructure/database/repositoryManager";
import { resolveHubAccess } from "~/modules/model-governance/application/connections";
import { preflightWorkspaceSpend } from "~/modules/model-governance/application/spend";
import {
  notFound,
  requireModelAction,
  requireWorkspaceProject,
} from "~/modules/model-registry/application/access";
import { weightsLocation, weightsPlacement } from "~/modules/model-registry/application/handles";
import { loadRegistryScope, versionStanding } from "~/modules/model-registry/application/scope";

export const METHOD_SHAPES: Record<TrainingMethod, DatasetShape[]> = {
  sft: ["messages"],
  distillation: ["messages"],
  vision_sft: ["image_text"],
  dpo: ["preference"],
  rft: ["prompt_grader"],
  continued_pretraining: ["text"],
  embedding: ["retrieval"],
  merge: [],
  quantise: [],
};

export interface TrainingInputs {
  datasetShape: DatasetShape | null;
  datasetTokens: number;
  datasetRows: number;
  graderKind: GraderKind | null;
}

export async function loadTrainingInputs(
  repositories: RepositoryManager,
  workspaceId: string,
  datasetVersionId: string | null,
  graderId: string | null,
): Promise<TrainingInputs> {
  const profile = datasetVersionId ? await repositories.modelDatasets.get(datasetVersionId) : null;
  const grader = graderId ? await repositories.modelGraders.get(workspaceId, graderId) : null;

  if (datasetVersionId && (!profile || profile.workspace_id !== workspaceId)) {
    throw notFound("Dataset");
  }

  if (graderId && !grader) {
    throw notFound("Grader");
  }

  const stats: DatasetStats = profile?.stats ?? {};
  const train = stats.splits?.find((split) => split.name === "train");

  return {
    datasetShape: profile?.shape ?? null,
    datasetTokens: train?.tokens ?? stats.tokens ?? 0,
    datasetRows: train?.rows ?? stats.rows ?? 0,
    graderKind: grader?.config.kind ?? null,
  };
}

export function modificationCompute(
  parameterCount: number | null,
  tokens: number,
  baseTrainingFlops: number | null,
): ModificationCompute | null {
  return parameterCount === null || tokens === 0
    ? null
    : assessModificationCompute({
        modificationFlops: estimateTrainingFlops(parameterCount, tokens),
        baseTrainingFlops,
      });
}

export async function planTraining(
  context: ServiceContext,
  workspaceId: string,
  input: TrainingPlanRequest,
): Promise<TrainingPlan> {
  await requireModelAction(context, workspaceId, "view");

  const request = trainingPlanRequestSchema.parse(input);
  const repositories = context.repositories;
  const projectId = await requireWorkspaceProject(context, workspaceId, request.projectId);
  const versionIds = [
    request.baseVersionId,
    ...(request.trainDatasetVersionId ? [request.trainDatasetVersionId] : []),
  ];
  const scope = await loadRegistryScope(repositories, workspaceId, projectId, { versionIds });
  const base = scope.versions.find((version) => version.id === request.baseVersionId);
  const baseAsset = base ? scope.assets.get(base.asset_id) : undefined;

  if (!base || !baseAsset) {
    throw notFound("Base model");
  }

  const dataset = request.trainDatasetVersionId
    ? scope.versions.find((version) => version.id === request.trainDatasetVersionId)
    : undefined;
  const inputs = await loadTrainingInputs(
    repositories,
    workspaceId,
    request.trainDatasetVersionId,
    request.graderId,
  );
  const tokens = trainingTokens({
    method: request.method,
    datasetTokens: inputs.datasetTokens,
    epochs: request.hyperparameters.epochs,
    generationsPerPrompt: request.hyperparameters.generationsPerPrompt,
  });
  const location = weightsLocation(baseAsset, base);
  const connections = await repositories.modelConnections.listConnections(workspaceId);
  const options = resolveTrainerOptions({
    manifests: listProviderManifests(),
    connections: connections.map((connection) => ({
      provider: connection.provider,
      capabilities: connection.capabilities,
    })),
    hubConnected: (await resolveHubAccess(repositories, workspaceId)) !== null,
    method: request.method,
    adaptation: request.adaptation,
    base: {
      kind: baseAsset.kind === "adapter" ? "adapter" : "model",
      placement: weightsPlacement(location),
      modelType: base.attributes.architecture?.modelType ?? null,
      parameterCount: base.attributes.parameterCount,
      repo: location?.kind === "hub" ? location.repo : null,
    },
    datasetShape: inputs.datasetShape,
    graderKind: inputs.graderKind,
    tokens,
  });
  const cheapest = options.find((option) => option.supported && option.connected);

  return {
    options,
    compute: modificationCompute(base.attributes.parameterCount, tokens, null),
    tokens,
    preflight: await preflightWorkspaceSpend(
      repositories,
      workspaceId,
      projectId,
      cheapest?.estimate.usd ?? null,
    ),
    verdicts: {
      base: versionStanding(scope, base)?.verdict ?? {
        effect: "review",
        matches: [],
        policyHashes: [],
      },
      dataset: dataset ? (versionStanding(scope, dataset)?.verdict ?? null) : null,
    },
  };
}

export async function recommendTrainingPlan(
  context: ServiceContext,
  workspaceId: string,
  input: TrainingRecommendationRequest,
): Promise<TrainingRecommendation> {
  await requireModelAction(context, workspaceId, "view");

  const request = trainingRecommendationRequestSchema.parse(input);
  const repositories = context.repositories;
  const projectId = await requireWorkspaceProject(context, workspaceId, request.projectId);
  const scope = await loadRegistryScope(repositories, workspaceId, projectId);
  const inputs = await loadTrainingInputs(
    repositories,
    workspaceId,
    request.datasetVersionId,
    request.graderId,
  );
  const bases = scope.versions.flatMap((version) => {
    const asset = scope.assets.get(version.asset_id);

    return asset?.kind === "model" &&
      versionStanding(scope, version)?.usable &&
      weightsLocation(asset, version)?.kind === "hub"
      ? [
          {
            versionId: version.id,
            name: asset.display_name,
            parameterCount: version.attributes.parameterCount,
          },
        ]
      : [];
  });
  const draft = recommendTraining({
    goal: request.goal,
    shape: inputs.datasetShape,
    rows: inputs.datasetRows,
    hasGrader: inputs.graderKind !== null,
    bases,
  });
  const plan = draft.base
    ? await planTraining(context, workspaceId, {
        projectId,
        method: draft.method,
        adaptation: draft.adaptation,
        baseVersionId: draft.base.versionId,
        trainDatasetVersionId: request.datasetVersionId,
        graderId: request.graderId,
        hyperparameters: draft.hyperparameters,
      })
    : null;
  const option = plan?.options.find((item) => item.supported && item.connected);
  const reasons = [...draft.reasons];

  if (plan && option) {
    reasons.push(
      `${option.trainerName} is the cheapest connected trainer that supports this${option.estimate.usd === null ? "" : `, at about $${option.estimate.usd}`}`,
    );
  } else if (plan) {
    reasons.push("No connected trainer supports this yet; connect one under Governance");
  }

  return {
    method: draft.method,
    adaptation: draft.adaptation,
    baseVersionId: draft.base?.versionId ?? null,
    target: option
      ? {
          provider: option.provider,
          target: option.trainer,
          hardware: option.hardware[0]?.id ?? null,
          region: option.regions[0]?.id ?? null,
        }
      : null,
    hyperparameters: draft.hyperparameters,
    reasons,
  };
}
