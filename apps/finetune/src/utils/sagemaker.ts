import type { TrainingDeployment, TrainingJob } from "@assistant/schemas";
import { z } from "zod";

import { isRecord } from "../utils/objects.js";
import { optionalString } from "../utils/strings.js";
import { toDate } from "../utils/dates.js";

export class SageMakerApiError extends Error {
	constructor(
		message: string,
		readonly status: number,
		readonly providerMessage: string,
	) {
		super(`SageMaker API error (${status}): ${providerMessage || message}`);
		this.name = "SageMakerApiError";
	}
}

export function isSageMakerAlreadyExistsError(error: unknown): boolean {
	return error instanceof SageMakerApiError && /already exist/i.test(error.providerMessage);
}

export function isSageMakerIgnorableDeleteError(error: unknown): boolean {
	return (
		error instanceof SageMakerApiError &&
		/(does not exist|not found|could not find|cannot find|in use|being used)/i.test(
			error.providerMessage,
		)
	);
}

export function mapSageMakerStatus(status: string | undefined): string {
	switch (status) {
		case "Completed":
			return "Completed";
		case "Failed":
			return "Failed";
		case "Stopping":
			return "Stopping";
		case "Stopped":
			return "Stopped";
		default:
			return "InProgress";
	}
}

export function getSageMakerErrorMessage(payload: unknown, fallback: string): string {
	if (!isRecord(payload)) return fallback;

	return optionalString(payload.message) || optionalString(payload.Message) || fallback;
}

const sageMakerChannelSchema = z.object({
	ChannelName: z.string().optional(),
	DataSource: z
		.object({
			S3DataSource: z
				.object({
					S3Uri: z.unknown().optional(),
				})
				.optional(),
		})
		.optional(),
});

const sageMakerTrainingJobResponseSchema = z.object({
	TrainingJobName: z.string().optional(),
	TrainingJobStatus: z.string().optional(),
	ModelId: z.unknown().optional(),
	HyperParameters: z.record(z.string(), z.unknown()).optional(),
	AlgorithmSpecification: z
		.object({
			TrainingImage: z.unknown().optional(),
		})
		.optional(),
	InputDataConfig: z.array(sageMakerChannelSchema).optional(),
	OutputDataConfig: z
		.object({
			S3OutputPath: z.unknown().optional(),
		})
		.optional(),
	ModelArtifacts: z
		.object({
			S3ModelArtifacts: z.unknown().optional(),
		})
		.optional(),
	CreationTime: z.unknown().optional(),
	TrainingStartTime: z.unknown().optional(),
	TrainingEndTime: z.unknown().optional(),
	FailureReason: z.unknown().optional(),
});

const sageMakerEndpointResponseSchema = z.object({
	EndpointName: z.string().optional(),
	EndpointStatus: z.string().optional(),
	EndpointConfigName: z.string().optional(),
	CreationTime: z.unknown().optional(),
	FailureReason: z.unknown().optional(),
});

type SageMakerChannel = z.infer<typeof sageMakerChannelSchema>;

export function mapSageMakerTrainingJob(data: unknown, fallbackJobName: string): TrainingJob {
	const response = sageMakerTrainingJobResponseSchema.parse(data);
	const hyperParameters = response.HyperParameters ?? {};

	return {
		provider: "aws-sagemaker",
		jobName: response.TrainingJobName || fallbackJobName,
		status: mapSageMakerStatus(response.TrainingJobStatus),
		modelId: optionalString(response.ModelId) || "unknown",
		baseModel: optionalString(hyperParameters.model_name) || "unknown",
		trainingImage: optionalString(response.AlgorithmSpecification?.TrainingImage),
		trainingDataS3Uri: findSageMakerChannel(response.InputDataConfig, "train"),
		validationDataS3Uri: findSageMakerChannel(response.InputDataConfig, "test"),
		outputS3Uri: optionalString(response.OutputDataConfig?.S3OutputPath),
		modelArtifactsS3Uri: optionalString(response.ModelArtifacts?.S3ModelArtifacts),
		createdAt: toDate(response.CreationTime)?.toISOString(),
		startedAt: toDate(response.TrainingStartTime)?.toISOString(),
		completedAt: toDate(response.TrainingEndTime)?.toISOString(),
		failureReason: optionalString(response.FailureReason),
		providerResponse: response,
	};
}

export function mapSageMakerDeployment(
	data: unknown,
	fallbackEndpointName: string,
): TrainingDeployment {
	const response = sageMakerEndpointResponseSchema.parse(data);
	const endpointConfigName = response.EndpointConfigName || fallbackEndpointName;
	const endpointName = response.EndpointName || fallbackEndpointName;

	return {
		provider: "aws-sagemaker",
		deploymentName: fallbackEndpointName,
		modelName: endpointConfigName,
		endpointConfigName,
		endpointName,
		status: response.EndpointStatus || "Unknown",
		modelId: "unknown",
		createdAt: toDate(response.CreationTime)?.toISOString(),
		failureReason: optionalString(response.FailureReason),
		providerResponse: response,
	};
}

function findSageMakerChannel(
	channels: SageMakerChannel[] | undefined,
	channelName: string,
): string | undefined {
	const channel = (channels ?? []).find((item) => item.ChannelName === channelName);
	return optionalString(channel?.DataSource?.S3DataSource?.S3Uri);
}
