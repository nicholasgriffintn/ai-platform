import type { D1Database } from "@cloudflare/workers-types";

export interface AwsEnv {
	AWS_REGION?: string;
	AWS_ACCESS_KEY_ID?: string;
	AWS_SECRET_ACCESS_KEY?: string;
	AWS_SESSION_TOKEN?: string;
}

export interface SageMakerEnv extends AwsEnv {
	SAGEMAKER_REGION?: string;
	SAGEMAKER_AWS_ACCESS_KEY_ID?: string;
	SAGEMAKER_AWS_SECRET_ACCESS_KEY?: string;
	SAGEMAKER_AWS_SESSION_TOKEN?: string;
	SAGEMAKER_ROLE_ARN?: string;
	SAGEMAKER_OUTPUT_BUCKET?: string;
	SAGEMAKER_VOLUME_SIZE_GB?: string;
}

export interface Env extends SageMakerEnv {
	DB: D1Database;
	BEDROCK_ROLE_ARN?: string;
	BEDROCK_OUTPUT_BUCKET?: string;
	BEDROCK_KMS_KEY_ARN?: string;
	BEDROCK_VPC_SECURITY_GROUP_IDS?: string;
	BEDROCK_VPC_SUBNET_IDS?: string;
	FINETUNE_WORKER_TOKEN?: string;
	LOG_LEVEL?: string;
}
