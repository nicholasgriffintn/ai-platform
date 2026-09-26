import type {
  TrainingMethod,
  TrainingRunStatus,
  TrainingSpec,
  TrainingMetricPoint,
} from "@ngriffin_uk/polychat-schemas";
import { readArray, readFiniteNumber, readRecord } from "@ngriffin_uk/polychat-utility-core";

import { unsupported } from "../errors.js";
import type { ModelHandle, TrainingCheckpointState, TrainingSubmission } from "../types.js";

export function hubWeights(model: ModelHandle): { repo: string; revision: string } {
  if (model.weights.kind !== "hub") {
    throw unsupported(`${model.name} is not stored on the Hugging Face Hub`);
  }

  return { repo: model.weights.repo, revision: model.weights.revision };
}

export function outputKind(spec: TrainingSpec): "model" | "adapter" {
  if (spec.method === "merge" || spec.method === "quantise" || spec.method === "embedding") {
    return "model";
  }

  return spec.adaptation === "full" ? "model" : "adapter";
}

export function scriptSpec(submission: TrainingSubmission) {
  const base = hubWeights(submission.base);

  return {
    method: submission.spec.method,
    adaptation: submission.spec.adaptation,
    base: { ...base, remoteCode: submission.base.remoteCode },
    merge: submission.merge.map((item) => ({ ...hubWeights(item), kind: item.kind })),
    hyperparameters: submission.spec.hyperparameters,
    grader: submission.grader
      ? { metric: submission.grader.metric, config: submission.grader.config }
      : null,
    outputRepository: submission.outputRepository,
    quantisation: submission.spec.quantisation,
    checkpointEvery: submission.spec.checkpointEvery,
    mergeAdapter: false,
  };
}

export const DATA_FREE_METHODS: readonly TrainingMethod[] = ["merge", "quantise"];

export function requireTrainingData(submission: TrainingSubmission) {
  if (!DATA_FREE_METHODS.includes(submission.spec.method) && !submission.train) {
    throw unsupported(`${submission.spec.method} needs a training dataset`);
  }
}

export interface ReportedTrainingState {
  status: TrainingRunStatus | null;
  metrics: TrainingMetricPoint[];
  checkpoints: TrainingCheckpointState[];
  revision: string | null;
  error: string | null;
}

function nullableNumber(value: unknown): number | null {
  return readFiniteNumber(value) ?? null;
}

export function readReportedState(body: unknown): ReportedTrainingState {
  const record = readRecord(body);
  const status = record.status;

  return {
    status: status === "completed" ? "completed" : status === "failed" ? "failed" : null,
    metrics: readArray(record.metrics).map((entry) => {
      const point = readRecord(entry);

      return {
        step: Math.max(0, Math.round(readFiniteNumber(point.step) ?? 0)),
        epoch: nullableNumber(point.epoch),
        trainLoss: nullableNumber(point.trainLoss),
        validLoss: nullableNumber(point.validLoss),
        reward: nullableNumber(point.reward),
        learningRate: nullableNumber(point.learningRate),
      };
    }),
    checkpoints: readArray(record.checkpoints).flatMap((entry) => {
      const checkpoint = readRecord(entry);
      const step = readFiniteNumber(checkpoint.step);

      return typeof checkpoint.revision === "string" && step !== undefined
        ? [
            {
              step,
              providerRef: `${checkpoint.revision}:checkpoints/step-${step}`,
              metrics: {},
            },
          ]
        : [];
    }),
    revision: typeof record.revision === "string" ? record.revision : null,
    error: typeof record.error === "string" ? record.error : null,
  };
}
