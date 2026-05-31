import type {
	TrainingDeployment,
	TrainingDeploymentTarget,
	TrainingJob,
	TrainingModelDefinition,
	TrainingProviderId,
} from "@assistant/schemas";

import type { Env } from "./env.js";

export interface CreateTrainingJobOptions {
	provider: TrainingProviderId;
	jobName: string;
	model: TrainingModelDefinition;
	trainingDataS3Uri: string;
	validationDataS3Uri?: string;
	customModelName?: string;
	outputDataS3Uri?: string;
	hyperParameters?: Record<string, string | number | boolean>;
	roleArn?: string;
	instanceType?: string;
	instanceCount?: number;
	maxRuntimeSeconds?: number;
	entryPoint?: string;
	sourceS3Uri?: string;
	trainingImage?: string;
}

export interface CreateTrainingJobResult {
	job: TrainingJob;
	providerJobId?: string;
	metadata?: Record<string, unknown>;
}

export interface DeployModelOptions {
	model: TrainingModelDefinition;
	trainingJobName?: string;
	modelArtifactsS3Uri?: string;
	deploymentName: string;
	deploymentVersion?: string;
	deploymentTarget?: TrainingDeploymentTarget;
	roleArn?: string;
	instanceType?: string;
	instanceCount?: number;
	serverlessMemorySizeInMB?: number;
	serverlessMaxConcurrency?: number;
	serverlessProvisionedConcurrency?: number;
	inferenceImage?: string;
	environment?: Record<string, string>;
	onEvent?: (event: TrainingProviderEvent) => Promise<void> | void;
}

export interface DeployModelResult {
	deployment: TrainingDeployment;
}

export interface TrainingProviderEvent {
	jobName?: string;
	level: "info" | "warn" | "error";
	message: string;
	metadata?: Record<string, unknown>;
}

export interface DeleteDeploymentOptions {
	deployment: TrainingDeployment;
}

export interface TrainingProvider {
	readonly id: TrainingProviderId;
	createTrainingJob(options: CreateTrainingJobOptions): Promise<CreateTrainingJobResult>;
	getJobStatus(jobIdentifier: string): Promise<TrainingJob>;
	deployModel?(options: DeployModelOptions): Promise<DeployModelResult>;
	getDeployment?(endpointName: string): Promise<TrainingDeployment>;
	deleteDeployment?(options: DeleteDeploymentOptions): Promise<void>;
}

export interface TrainingProviderContext {
	env: Env;
}
