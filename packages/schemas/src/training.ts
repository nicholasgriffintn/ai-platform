import { z } from "zod";

export const trainingProviderSchema = z.enum(["aws-bedrock", "aws-sagemaker"]);
export const trainingModelFamilySchema = z.enum(["bedrock", "huggingface"]);
export const trainingInferenceRuntimeSchema = z.enum(["sagemaker-huggingface", "sagemaker-openai"]);
export const trainingDeploymentTargetSchema = z.enum([
	"sagemaker-endpoint",
	"sagemaker-serverless-endpoint",
	"bedrock-import",
]);
export const TRAINING_WORKER_USER_ID_HEADER = "X-Assistant-User-Id";
export const TRAINING_WORKER_TOKEN_HEADER = "X-Assistant-Worker-Token";
export const TRAINING_CHAT_MODEL_PREFIX = "training";
export const BEDROCK_IMPORT_ARCHIVE_EXTENSIONS = [".tar.gz", ".tgz", ".zip"] as const;
export const SAGEMAKER_GPU_ENDPOINT_INSTANCE_PREFIXES = [
	"ml.g4dn.",
	"ml.g5.",
	"ml.g6.",
	"ml.p2.",
	"ml.p3.",
	"ml.p4d.",
	"ml.p4de.",
	"ml.p5.",
] as const;

export const trainingSourceArchiveSchema = z.object({
	url: z.string().url(),
	s3Key: z.string().min(1).optional(),
	contentType: z.string().optional(),
});

export const trainingModelSchema = z.object({
	id: z.string(),
	provider: trainingProviderSchema,
	family: trainingModelFamilySchema,
	name: z.string(),
	description: z.string().optional(),
	baseModel: z.string(),
	defaultInstanceType: z.string().optional(),
	defaultDeploymentInstanceType: z.string().optional(),
	defaultHyperparameters: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
	defaultEntryPoint: z.string().optional(),
	defaultSourceS3Uri: z.string().startsWith("s3://").optional(),
	sourceArchive: trainingSourceArchiveSchema.optional(),
	trainingDataFileHyperparameter: z.string().optional(),
	validationDataFileHyperparameter: z.string().optional(),
	defaultDeploymentEnvironment: z.record(z.string(), z.string()).optional(),
	trainingImage: z.string().optional(),
	inferenceImage: z.string().optional(),
	inferenceRuntime: trainingInferenceRuntimeSchema.optional(),
	supportedTasks: z.array(z.string()).optional(),
});

export const trainingExampleFiltersSchema = z.object({
	appName: z.string().optional(),
	conversationId: z.string().optional(),
	minFeedbackRating: z.coerce.number().optional(),
	minQualityScore: z.coerce.number().optional(),
	limit: z.coerce.number().int().positive().max(5000).optional(),
});

export const trainingDatasetSchema = z
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

export const startTrainingJobSchema = z.object({
	provider: trainingProviderSchema.default("aws-sagemaker"),
	modelId: z.string().min(1),
	jobName: z.string().min(1).optional(),
	dataset: trainingDatasetSchema,
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

export const deployTrainingModelSchema = z.object({
	provider: trainingProviderSchema.default("aws-sagemaker"),
	modelId: z.string().min(1),
	deploymentTarget: trainingDeploymentTargetSchema.default("sagemaker-endpoint"),
	deploymentName: z.string().min(1).optional(),
	deploymentVersion: z.string().min(1).max(64).optional(),
	modelArtifactsS3Uri: z.string().startsWith("s3://").optional(),
	trainingJobName: z.string().min(1).optional(),
	roleArn: z.string().optional(),
	instanceType: z.string().optional(),
	instanceCount: z.coerce.number().int().positive().optional(),
	serverlessMemorySizeInMB: z.coerce.number().int().positive().optional(),
	serverlessMaxConcurrency: z.coerce.number().int().positive().optional(),
	serverlessProvisionedConcurrency: z.coerce.number().int().positive().optional(),
	inferenceImage: z.string().optional(),
	environment: z.record(z.string(), z.string()).optional(),
	tags: z.record(z.string(), z.string()).optional(),
});

export const trainingJobParamsSchema = z.object({
	provider: trainingProviderSchema,
	jobName: z.string().min(1),
});

export const trainingDeploymentParamsSchema = z.object({
	provider: trainingProviderSchema,
	endpointName: z.string().min(1),
});

export const trainingJobSchema = z.object({
	provider: trainingProviderSchema,
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

export const trainingDeploymentSchema = z.object({
	provider: trainingProviderSchema,
	deploymentTarget: trainingDeploymentTargetSchema.optional(),
	deploymentName: z.string(),
	deploymentVersion: z.string().optional(),
	modelName: z.string(),
	endpointConfigName: z.string(),
	endpointName: z.string(),
	chatModelId: z.string().optional(),
	status: z.string(),
	modelId: z.string(),
	modelArtifactsS3Uri: z.string().optional(),
	createdAt: z.string().optional(),
	failureReason: z.string().optional(),
	providerResponse: z.unknown().optional(),
});

export const trainingModelsResponseSchema = z.object({
	models: z.array(trainingModelSchema),
});

export const trainingJobsResponseSchema = z.object({
	jobs: z.array(trainingJobSchema),
});

export const trainingDeploymentsResponseSchema = z.object({
	deployments: z.array(trainingDeploymentSchema),
});

export const trainingJobEventSchema = z.object({
	id: z.string(),
	provider: trainingProviderSchema,
	jobName: z.string(),
	level: z.enum(["info", "warn", "error"]),
	message: z.string(),
	metadata: z.unknown().optional(),
	createdAt: z.string(),
});

export const trainingJobEventsResponseSchema = z.object({
	events: z.array(trainingJobEventSchema),
});

export const trainingDeploymentDeleteResponseSchema = z.object({
	success: z.boolean(),
	message: z.string(),
	providerDeleted: z.boolean(),
	manualDeletionRequired: z.boolean().optional(),
	error: z.string().optional(),
});

export const trainingWorkerStartJobSchema = startTrainingJobSchema.extend({
	model: trainingModelSchema,
	requestId: z.string().optional(),
});

export const trainingWorkerDeployModelSchema = deployTrainingModelSchema.extend({
	model: trainingModelSchema,
	requestId: z.string().optional(),
});

export type TrainingProviderId = z.infer<typeof trainingProviderSchema>;
export type TrainingModelFamily = z.infer<typeof trainingModelFamilySchema>;
export type TrainingInferenceRuntime = z.infer<typeof trainingInferenceRuntimeSchema>;
export type TrainingDeploymentTarget = z.infer<typeof trainingDeploymentTargetSchema>;
export type TrainingSourceArchive = z.infer<typeof trainingSourceArchiveSchema>;
export type TrainingModelDefinition = z.infer<typeof trainingModelSchema>;
export type TrainingDatasetInput = z.infer<typeof trainingDatasetSchema>;
export type StartTrainingJobRequest = z.infer<typeof startTrainingJobSchema>;
export type TrainingJob = z.infer<typeof trainingJobSchema>;
export type DeployTrainingModelRequest = z.infer<typeof deployTrainingModelSchema>;
export type TrainingDeployment = z.infer<typeof trainingDeploymentSchema>;
export type TrainingDeploymentDeleteResponse = z.infer<
	typeof trainingDeploymentDeleteResponseSchema
>;
export type TrainingJobEvent = z.infer<typeof trainingJobEventSchema>;
export type TrainingWorkerStartJobRequest = z.infer<typeof trainingWorkerStartJobSchema>;
export type TrainingWorkerDeployModelRequest = z.infer<typeof trainingWorkerDeployModelSchema>;

export function isSageMakerGpuImage(image?: string): boolean {
	return /(?:^|[-:])gpu(?:[-:]|$)|cu\d+/i.test(image || "");
}

export function isSageMakerGpuEndpointInstance(instanceType: string): boolean {
	const normalised = instanceType.toLowerCase();
	return SAGEMAKER_GPU_ENDPOINT_INSTANCE_PREFIXES.some((prefix) => normalised.startsWith(prefix));
}

export function getSageMakerEndpointInstanceCompatibilityError({
	instanceType,
	image,
}: {
	instanceType: string;
	image?: string;
}): string | undefined {
	if (!isSageMakerGpuImage(image) || isSageMakerGpuEndpointInstance(instanceType)) {
		return undefined;
	}

	return `Instance type ${instanceType} cannot run the configured SageMaker GPU image. Choose a GPU endpoint instance such as ml.g4dn.xlarge, ml.g5.xlarge, or ml.g5.2xlarge.`;
}

export function getTrainingDeploymentChatModelId({
	provider,
	endpointName,
}: {
	provider: TrainingProviderId;
	endpointName: string;
}): string {
	return `${TRAINING_CHAT_MODEL_PREFIX}:${provider}:${endpointName}`;
}

export function parseTrainingDeploymentChatModelId(
	modelId: string,
): { provider: TrainingProviderId; endpointName: string } | undefined {
	const prefix = `${TRAINING_CHAT_MODEL_PREFIX}:`;
	if (!modelId.startsWith(prefix)) return undefined;

	const value = modelId.slice(prefix.length);
	const [rawProvider, ...endpointParts] = value.split(":");
	const provider = trainingProviderSchema.safeParse(rawProvider).data;
	if (!provider) return undefined;

	const endpointName = endpointParts.join(":");
	return endpointName ? { provider, endpointName } : undefined;
}

export function getBedrockImportModelSourceUriError(s3Uri?: string): string | undefined {
	if (!s3Uri) return undefined;
	if (!s3Uri.startsWith("s3://")) {
		return "Bedrock import requires an S3 URI for Hugging Face model files.";
	}

	const normalised = s3Uri.toLowerCase();
	if (BEDROCK_IMPORT_ARCHIVE_EXTENSIONS.some((extension) => normalised.endsWith(extension))) {
		return "Bedrock import requires an S3 prefix containing Hugging Face model files, not a compressed SageMaker model archive.";
	}

	return undefined;
}
