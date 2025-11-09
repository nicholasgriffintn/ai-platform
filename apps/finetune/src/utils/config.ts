import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, "../../.env") });

export const config = {
	API_URL: process.env.API_URL || "https://polychat.app",
	API_KEY: process.env.API_KEY,
	AWS_REGION: process.env.AWS_REGION || "us-east-1",
	AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
	AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
	BEDROCK_TRAINING_BUCKET: process.env.BEDROCK_TRAINING_BUCKET,
	BEDROCK_OUTPUT_BUCKET: process.env.BEDROCK_OUTPUT_BUCKET,
	BEDROCK_ROLE_ARN: process.env.BEDROCK_ROLE_ARN,
	BEDROCK_KMS_KEY_ARN: process.env.BEDROCK_KMS_KEY_ARN,
	BEDROCK_VPC_SECURITY_GROUP_IDS:
		process.env.BEDROCK_VPC_SECURITY_GROUP_IDS?.split(","),
	BEDROCK_VPC_SUBNET_IDS: process.env.BEDROCK_VPC_SUBNET_IDS?.split(","),
};

export function validateConfig(required: string[]): void {
	const missing: string[] = [];

	for (const key of required) {
		if (!config[key as keyof typeof config]) {
			missing.push(key);
		}
	}

	if (missing.length > 0) {
		throw new Error(
			`Missing required configuration: ${missing.join(", ")}\n` +
				"Please check your .env file or environment variables.",
		);
	}
}
