export interface TrainingExample {
	schemaVersion: "bedrock-conversation-2024";
	system: Array<{ text: string }>;
	messages: Array<{
		role: "user" | "assistant";
		content: Array<{ text: string }>;
	}>;
}

export interface GenerateOptions {
	apiUrl: string;
	apiKey?: string;
	count: number;
	styles: string[];
	complexities: string[];
	model?: string;
}

export interface DistillationConfig {
	teacherModelIdentifier: string;
}

export interface BedrockJobConfig {
	jobName: string;
	customModelName: string;
	baseModelIdentifier: string;
	trainingDataS3Uri: string;
	validationDataS3Uri?: string;
	roleArn: string;
	outputDataS3Uri: string;
	hyperParameters?: Record<string, string>;
	customizationType?: "FINE_TUNING" | "CONTINUED_PRE_TRAINING" | "DISTILLATION";
	distillationConfig?: DistillationConfig;
}

export interface JobStatus {
	jobArn: string;
	jobName: string;
	status: "InProgress" | "Completed" | "Failed" | "Stopping" | "Stopped";
	message?: string;
	creationTime?: Date;
	lastModifiedTime?: Date;
	endTime?: Date;
	trainingMetrics?: {
		trainingLoss?: number;
	};
	validationMetrics?: {
		validationLoss?: number;
	};
	outputDataConfig?: {
		s3Uri: string;
	};
}

export interface JobRecord {
	jobArn: string;
	jobName: string;
	baseModel: string;
	customModelName: string;
	status: string;
	createdAt: number;
	updatedAt: number;
	metadata?: string;
}

export interface DatasetRecord {
	id?: number;
	project: string;
	trainPath: string;
	validationPath?: string;
	s3Uri?: string;
	createdAt: number;
	metadata?: string;
}
