import type { FineTuningModelDefinition } from "~/types/training";

type TrainingHyperparameterValue = string | number | boolean;
type TrainingHyperparameters = Record<string, TrainingHyperparameterValue>;

interface ResolveTrainingHyperparametersOptions {
	model: FineTuningModelDefinition;
	trainS3Uri?: string;
	validationS3Uri?: string;
	requestHyperparameters?: TrainingHyperparameters;
}

export function resolveTrainingHyperparameters({
	model,
	trainS3Uri,
	validationS3Uri,
	requestHyperparameters,
}: ResolveTrainingHyperparametersOptions): TrainingHyperparameters | undefined {
	const hyperparameters: TrainingHyperparameters = requestHyperparameters
		? { ...requestHyperparameters }
		: {};

	addChannelFileHyperparameter({
		hyperparameters,
		name: model.trainingDataFileHyperparameter,
		channelName: "train",
		s3Uri: trainS3Uri,
	});
	addChannelFileHyperparameter({
		hyperparameters,
		name: model.validationDataFileHyperparameter,
		channelName: "test",
		s3Uri: validationS3Uri,
	});

	return Object.keys(hyperparameters).length > 0 ? hyperparameters : undefined;
}

interface AddChannelFileHyperparameterOptions {
	hyperparameters: TrainingHyperparameters;
	name?: string;
	channelName: string;
	s3Uri?: string;
}

function addChannelFileHyperparameter({
	hyperparameters,
	name,
	channelName,
	s3Uri,
}: AddChannelFileHyperparameterOptions): void {
	if (!name || hyperparameters[name] !== undefined || !s3Uri) return;

	const filePath = getSageMakerChannelFilePath(channelName, s3Uri);
	if (filePath) {
		hyperparameters[name] = filePath;
	}
}

function getSageMakerChannelFilePath(channelName: string, s3Uri: string): string | undefined {
	const key = getS3ObjectKey(s3Uri);
	if (!key || key.endsWith("/")) return undefined;

	const filename = key.split("/").filter(Boolean).pop();
	return filename ? `/opt/ml/input/data/${channelName}/${filename}` : undefined;
}

function getS3ObjectKey(s3Uri: string): string | undefined {
	if (!s3Uri.startsWith("s3://")) return undefined;

	const path = s3Uri.slice("s3://".length);
	const keyStart = path.indexOf("/");
	return keyStart === -1 ? undefined : path.slice(keyStart + 1);
}
