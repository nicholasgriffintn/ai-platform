import type {
  Adaptation,
  StartTrainingRunRequest,
  TrainerOption,
  TrainingHyperparameters,
  TrainingMethod,
  TrainingPlanRequest,
  TrainingRecommendation,
} from "@ngriffin_uk/polychat-schemas";

export interface TrainingDraft {
  goal: string;
  method: TrainingMethod;
  adaptation: Adaptation;
  baseVersionId: string;
  datasetVersionId: string;
  graderId: string;
  outputName: string;
  epochs: number;
  learningRate: string;
  loraRank: number;
  optionKey: string | null;
  hardware: string | null;
  region: string | null;
}

export const EMPTY_TRAINING_DRAFT: TrainingDraft = {
  goal: "",
  method: "sft",
  adaptation: "lora",
  baseVersionId: "",
  datasetVersionId: "",
  graderId: "",
  outputName: "",
  epochs: 2,
  learningRate: "",
  loraRank: 16,
  optionKey: null,
  hardware: null,
  region: null,
};

const NEEDS_DATASET = new Set<TrainingMethod>([
  "sft",
  "dpo",
  "rft",
  "distillation",
  "continued_pretraining",
  "embedding",
  "vision_sft",
]);

export function needsDataset(method: TrainingMethod): boolean {
  return NEEDS_DATASET.has(method);
}

function hyperparameters(draft: TrainingDraft): Partial<TrainingHyperparameters> {
  const learningRate = Number(draft.learningRate);

  return {
    epochs: draft.epochs,
    loraRank: draft.loraRank,
    loraAlpha: draft.loraRank * 2,
    learningRate:
      draft.learningRate && Number.isFinite(learningRate) && learningRate > 0 ? learningRate : null,
  };
}

export function trainingPlanRequest(
  draft: TrainingDraft,
  projectId: string | null,
): TrainingPlanRequest | null {
  if (!draft.baseVersionId || (needsDataset(draft.method) && !draft.datasetVersionId)) {
    return null;
  }

  if (draft.method === "rft" && !draft.graderId) {
    return null;
  }

  return {
    projectId,
    method: draft.method,
    adaptation: draft.adaptation,
    baseVersionId: draft.baseVersionId,
    trainDatasetVersionId: needsDataset(draft.method) ? draft.datasetVersionId : null,
    graderId: draft.graderId || null,
    hyperparameters: hyperparameters(draft),
  };
}

export function applyRecommendation(
  draft: TrainingDraft,
  recommendation: TrainingRecommendation,
): TrainingDraft {
  return {
    ...draft,
    method: recommendation.method,
    adaptation: recommendation.adaptation,
    baseVersionId: recommendation.baseVersionId ?? draft.baseVersionId,
    epochs: recommendation.hyperparameters.epochs,
    loraRank: recommendation.hyperparameters.loraRank,
    learningRate:
      recommendation.hyperparameters.learningRate === null
        ? ""
        : String(recommendation.hyperparameters.learningRate),
    optionKey: recommendation.target
      ? `${recommendation.target.provider}:${recommendation.target.target}`
      : null,
    hardware: recommendation.target?.hardware ?? null,
    region: recommendation.target?.region ?? null,
  };
}

export function startRunRequest(
  draft: TrainingDraft,
  option: TrainerOption,
  projectId: string | null,
): StartTrainingRunRequest {
  return {
    projectId,
    spec: {
      method: draft.method,
      adaptation: draft.adaptation,
      baseVersionId: draft.baseVersionId,
      trainDatasetVersionId: needsDataset(draft.method) ? draft.datasetVersionId : null,
      graderId: draft.graderId || null,
      hyperparameters: hyperparameters(draft),
      target: {
        provider: option.provider,
        target: option.trainer,
        hardware: draft.hardware ?? option.hardware[0]?.id ?? null,
        region: draft.region ?? option.regions[0]?.id ?? null,
      },
      outputName: draft.outputName,
    },
  };
}
