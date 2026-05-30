import type {
	FineTunedDeployment,
	FineTuningJob,
	FineTuningModelDefinition,
	FineTuningProviderId,
} from "@assistant/schemas";

import type { Env } from "./env.js";

export interface CreateTrainingJobOptions {
	provider: FineTuningProviderId;
	jobName: string;
	model: FineTuningModelDefinition;
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
	job: FineTuningJob;
	providerJobId?: string;
	metadata?: Record<string, unknown>;
}

export interface DeployModelOptions {
	model: FineTuningModelDefinition;
	trainingJobName?: string;
	modelArtifactsS3Uri?: string;
	deploymentName: string;
	roleArn?: string;
	instanceType?: string;
	instanceCount?: number;
	inferenceImage?: string;
}

export interface DeployModelResult {
	deployment: FineTunedDeployment;
}

export interface FineTuneProvider {
	readonly id: FineTuningProviderId;
	createTrainingJob(options: CreateTrainingJobOptions): Promise<CreateTrainingJobResult>;
	getJobStatus(jobIdentifier: string): Promise<FineTuningJob>;
	deployModel?(options: DeployModelOptions): Promise<DeployModelResult>;
	getDeployment?(endpointName: string): Promise<FineTunedDeployment>;
}

export interface FineTuneProviderContext {
	env: Env;
}
