import { z } from "zod";

export const fineTuningProviderSchema = z.enum(["aws-bedrock", "aws-sagemaker"]);
export const fineTuningModelFamilySchema = z.enum(["bedrock", "huggingface"]);

export const fineTuningModelSchema = z.object({
	id: z.string(),
	provider: fineTuningProviderSchema,
	family: fineTuningModelFamilySchema,
	name: z.string(),
	description: z.string().optional(),
	baseModel: z.string(),
	defaultInstanceType: z.string().optional(),
	defaultDeploymentInstanceType: z.string().optional(),
	defaultHyperparameters: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
	trainingImage: z.string().optional(),
	inferenceImage: z.string().optional(),
	supportedTasks: z.array(z.string()).optional(),
});

export const trainingExampleFiltersSchema = z.object({
	appName: z.string().optional(),
	conversationId: z.string().optional(),
	minFeedbackRating: z.coerce.number().optional(),
	minQualityScore: z.coerce.number().optional(),
	limit: z.coerce.number().int().positive().max(5000).optional(),
});

export const fineTuningDatasetSchema = z
	.object({
		trainS3Uri: z.string().startsWith("s3://").optional(),
		validationS3Uri: z.string().startsWith("s3://").optional(),
		trainingExampleFilters: trainingExampleFiltersSchema.optional(),
	})
	.refine((data) => data.trainS3Uri || data.trainingExampleFilters, {
		message: "Provide trainS3Uri or trainingExampleFilters",
	});

const stringNumberBooleanRecordSchema = z.record(
	z.string(),
	z.union([z.string(), z.number(), z.boolean()]),
);

export const startFineTuningJobSchema = z.object({
	provider: fineTuningProviderSchema.default("aws-sagemaker"),
	modelId: z.string().min(1),
	jobName: z.string().min(1).optional(),
	dataset: fineTuningDatasetSchema,
	hyperparameters: stringNumberBooleanRecordSchema.optional(),
	instanceType: z.string().optional(),
	instanceCount: z.coerce.number().int().positive().optional(),
	maxRuntimeSeconds: z.coerce.number().int().positive().optional(),
	outputS3Uri: z.string().startsWith("s3://").optional(),
	roleArn: z.string().optional(),
	entryPoint: z.string().optional(),
	sourceS3Uri: z.string().startsWith("s3://").optional(),
	trainingImage: z.string().optional(),
	tags: z.record(z.string(), z.string()).optional(),
});

export const deployFineTunedModelSchema = z.object({
	provider: fineTuningProviderSchema.default("aws-sagemaker"),
	modelId: z.string().min(1),
	deploymentName: z.string().min(1).optional(),
	modelArtifactsS3Uri: z.string().startsWith("s3://").optional(),
	trainingJobName: z.string().min(1).optional(),
	roleArn: z.string().optional(),
	instanceType: z.string().optional(),
	instanceCount: z.coerce.number().int().positive().optional(),
	inferenceImage: z.string().optional(),
	environment: z.record(z.string(), z.string()).optional(),
	tags: z.record(z.string(), z.string()).optional(),
});

export const fineTuningJobParamsSchema = z.object({
	provider: fineTuningProviderSchema,
	jobName: z.string().min(1),
});

export const fineTunedDeploymentParamsSchema = z.object({
	provider: fineTuningProviderSchema,
	endpointName: z.string().min(1),
});

export const fineTuningJobSchema = z.object({
	provider: fineTuningProviderSchema,
	jobName: z.string(),
	status: z.string(),
	modelId: z.string(),
	baseModel: z.string(),
	trainingImage: z.string().optional(),
	trainingDataS3Uri: z.string().optional(),
	validationDataS3Uri: z.string().optional(),
	outputS3Uri: z.string().optional(),
	modelArtifactsS3Uri: z.string().optional(),
	createdAt: z.string().optional(),
	startedAt: z.string().optional(),
	completedAt: z.string().optional(),
	failureReason: z.string().optional(),
	providerResponse: z.unknown().optional(),
});

export const fineTunedDeploymentSchema = z.object({
	provider: fineTuningProviderSchema,
	deploymentName: z.string(),
	modelName: z.string(),
	endpointConfigName: z.string(),
	endpointName: z.string(),
	status: z.string(),
	modelId: z.string(),
	modelArtifactsS3Uri: z.string().optional(),
	createdAt: z.string().optional(),
	failureReason: z.string().optional(),
	providerResponse: z.unknown().optional(),
});

export const fineTuningModelsResponseSchema = z.object({
	models: z.array(fineTuningModelSchema),
});

export const fineTuningJobEventSchema = z.object({
	id: z.string(),
	provider: fineTuningProviderSchema,
	jobName: z.string(),
	level: z.enum(["info", "warn", "error"]),
	message: z.string(),
	metadata: z.unknown().optional(),
	createdAt: z.string(),
});

export const fineTuningJobEventsResponseSchema = z.object({
	events: z.array(fineTuningJobEventSchema),
});

export const finetuneWorkerStartJobSchema = startFineTuningJobSchema.extend({
	model: fineTuningModelSchema,
	userId: z.coerce.number().int().positive().optional(),
	requestId: z.string().optional(),
});

export const finetuneWorkerDeployModelSchema = deployFineTunedModelSchema.extend({
	model: fineTuningModelSchema,
	userId: z.coerce.number().int().positive().optional(),
	requestId: z.string().optional(),
});

export type FineTuningProviderId = z.infer<typeof fineTuningProviderSchema>;
export type FineTuningModelFamily = z.infer<typeof fineTuningModelFamilySchema>;
export type FineTuningModelDefinition = z.infer<typeof fineTuningModelSchema>;
export type FineTuningDatasetInput = z.infer<typeof fineTuningDatasetSchema>;
export type StartFineTuningJobRequest = z.infer<typeof startFineTuningJobSchema>;
export type FineTuningJob = z.infer<typeof fineTuningJobSchema>;
export type DeployFineTunedModelRequest = z.infer<typeof deployFineTunedModelSchema>;
export type FineTunedDeployment = z.infer<typeof fineTunedDeploymentSchema>;
export type FineTuningJobEvent = z.infer<typeof fineTuningJobEventSchema>;
export type FinetuneWorkerStartJobRequest = z.infer<typeof finetuneWorkerStartJobSchema>;
export type FinetuneWorkerDeployModelRequest = z.infer<typeof finetuneWorkerDeployModelSchema>;
