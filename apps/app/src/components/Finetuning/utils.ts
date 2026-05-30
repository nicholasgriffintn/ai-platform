import type {
	FineTunedDeployment,
	FineTuningJob,
	FineTuningModelDefinition,
	FineTuningProviderId,
} from "@assistant/schemas";

import { isRecord } from "~/lib/objects";

type TrainingHyperparameterValue = string | number | boolean;

const DEPLOYABLE_TRAINING_PROVIDER: FineTuningProviderId = "aws-sagemaker";
const COMPLETED_JOB_STATUSES = new Set(["completed"]);

export type TrainingDatasetMode = "s3" | "examples";

export function trainingRecordKey(record: FineTuningJob | FineTunedDeployment): string {
	if ("jobName" in record) {
		return `${record.provider}:${record.jobName}`;
	}

	return `${record.provider}:${record.endpointName}`;
}

export function getTrainingModelLabel(model: FineTuningModelDefinition): string {
	return `${model.name} (${model.provider})`;
}

export function formatTrainingDate(value?: string): string {
	if (!value) return "Not recorded";

	return new Date(value).toLocaleString();
}

export function parseTrainingHyperparameters(
	value: string,
): Record<string, TrainingHyperparameterValue> | undefined {
	const trimmed = value.trim();
	if (!trimmed) return undefined;

	const parsed: unknown = JSON.parse(trimmed);
	if (!isRecord(parsed)) {
		throw new Error("Hyperparameters must be a JSON object");
	}

	const hyperparameters: Record<string, TrainingHyperparameterValue> = {};
	for (const [key, hyperparameterValue] of Object.entries(parsed)) {
		if (!isTrainingHyperparameterValue(hyperparameterValue)) {
			throw new Error(`${key} must be a string, number, or boolean`);
		}

		hyperparameters[key] = hyperparameterValue;
	}

	return hyperparameters;
}

export function formatTrainingHyperparameters(
	value: Record<string, TrainingHyperparameterValue>,
): string {
	return JSON.stringify(value, null, 2);
}

export function parseTrainingDatasetMode(value: string): TrainingDatasetMode {
	return value === "examples" ? "examples" : "s3";
}

export function parseOptionalTrainingNumber(value: string, fieldName: string): number | undefined {
	const trimmed = value.trim();
	if (!trimmed) return undefined;

	const parsed = Number(trimmed);
	if (!Number.isFinite(parsed)) {
		throw new Error(`${fieldName} must be a valid number`);
	}

	return parsed;
}

export function parseOptionalPositiveInteger(value: string, fieldName: string): number | undefined {
	const parsed = parseOptionalTrainingNumber(value, fieldName);
	if (typeof parsed === "undefined") return undefined;

	if (!Number.isInteger(parsed) || parsed <= 0) {
		throw new Error(`${fieldName} must be a positive whole number`);
	}

	return parsed;
}

export function getDeployableTrainingModels(
	models: FineTuningModelDefinition[],
): FineTuningModelDefinition[] {
	return models.filter(
		(model) => model.provider === DEPLOYABLE_TRAINING_PROVIDER && Boolean(model.inferenceImage),
	);
}

export function getDeploymentTrainingJobs(jobs: FineTuningJob[], modelId: string): FineTuningJob[] {
	return jobs.filter(
		(job) =>
			job.provider === DEPLOYABLE_TRAINING_PROVIDER &&
			job.modelId === modelId &&
			COMPLETED_JOB_STATUSES.has(job.status.toLowerCase()),
	);
}

export function getStatusClassName(status: string): string {
	const normalised = status.toLowerCase();

	if (["completed", "inservice", "in service"].includes(normalised)) {
		return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300";
	}

	if (["failed", "error", "outofservice", "out of service"].includes(normalised)) {
		return "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300";
	}

	if (["starting", "creating", "inprogress", "in progress", "updating"].includes(normalised)) {
		return "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300";
	}

	return "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300";
}

function isTrainingHyperparameterValue(value: unknown): value is TrainingHyperparameterValue {
	if (typeof value === "number") return Number.isFinite(value);

	return typeof value === "string" || typeof value === "boolean";
}
