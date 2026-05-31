import type { TrainingModelDefinition } from "@assistant/schemas";

import { HuggingFaceHub, type HuggingFaceHubModelFile } from "../lib/HuggingFaceHub.js";
import { S3ObjectStore, type AwsS3Credentials } from "../lib/S3ObjectStore.js";
import type { Env } from "../types/env.js";
import type { TrainingProviderEvent } from "../types/providers.js";
import { sanitiseResourceName } from "../utils/names.js";

interface StageBedrockImportSourceOptions {
	env: BedrockImportSourceEnv;
	model: TrainingModelDefinition;
	onEvent?: (event: TrainingProviderEvent) => Promise<void> | void;
	fetcher?: typeof fetch;
}

type BedrockImportSourceEnv = Pick<
	Env,
	| "AWS_REGION"
	| "AWS_ACCESS_KEY_ID"
	| "AWS_SECRET_ACCESS_KEY"
	| "AWS_SESSION_TOKEN"
	| "BEDROCK_IMPORT_BUCKET"
	| "BEDROCK_OUTPUT_BUCKET"
	| "HUGGINGFACE_TOKEN"
>;

export async function stageBedrockImportSource({
	env,
	model,
	onEvent,
	fetcher = fetch,
}: StageBedrockImportSourceOptions): Promise<string> {
	if (model.family !== "huggingface") {
		throw new Error("Bedrock import requires modelArtifactsS3Uri for non-Hugging Face models");
	}

	const bucket = env.BEDROCK_IMPORT_BUCKET || env.BEDROCK_OUTPUT_BUCKET;
	if (!bucket) {
		throw new Error("Missing BEDROCK_IMPORT_BUCKET or BEDROCK_OUTPUT_BUCKET");
	}

	const credentials = getAwsS3Credentials(env);
	const region = env.AWS_REGION || "us-east-1";
	const objectStore = new S3ObjectStore({
		bucket,
		region,
		credentials,
		fetcher,
	});
	const hub = new HuggingFaceHub({
		token: env.HUGGINGFACE_TOKEN,
		fetcher,
	});
	const keyPrefix = S3ObjectStore.joinKey(
		"models",
		sanitiseResourceName(model.baseModel, { fallback: "model" }),
	);
	const modelArtifactsS3Uri = objectStore.getPrefixUri(keyPrefix);
	const files = await hub.listModelFiles(model.baseModel);

	await onEvent?.({
		level: "info",
		message: "Hugging Face model staging started",
		metadata: {
			modelId: model.id,
			baseModel: model.baseModel,
			fileCount: files.length,
			modelArtifactsS3Uri,
		},
	});

	const result = await stageHubModelFiles({
		hub,
		objectStore,
		keyPrefix,
		files,
	});

	await onEvent?.({
		level: "info",
		message: "Hugging Face model staging completed",
		metadata: {
			modelId: model.id,
			baseModel: model.baseModel,
			uploadedFileCount: result.uploaded,
			skippedFileCount: result.skipped,
			modelArtifactsS3Uri,
		},
	});

	return modelArtifactsS3Uri;
}

function getAwsS3Credentials(env: BedrockImportSourceEnv): AwsS3Credentials {
	if (!env.AWS_ACCESS_KEY_ID || !env.AWS_SECRET_ACCESS_KEY) {
		throw new Error("Missing AWS credentials for Bedrock import staging");
	}

	return {
		accessKeyId: env.AWS_ACCESS_KEY_ID,
		secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
		sessionToken: env.AWS_SESSION_TOKEN,
	};
}

async function stageHubModelFiles({
	hub,
	objectStore,
	keyPrefix,
	files,
}: {
	hub: HuggingFaceHub;
	objectStore: S3ObjectStore;
	keyPrefix: string;
	files: HuggingFaceHubModelFile[];
}): Promise<{ uploaded: number; skipped: number }> {
	let uploaded = 0;
	let skipped = 0;

	for (const file of files) {
		const key = S3ObjectStore.joinKey(keyPrefix, file.path);
		if (await objectStore.hasObject(key)) {
			skipped += 1;
			continue;
		}

		const source = await hub.downloadModelFile(file);
		await objectStore.putObject({
			key,
			body: source.body ?? (await source.arrayBuffer()),
			contentType: source.headers.get("content-type") || "application/octet-stream",
		});
		uploaded += 1;
	}

	return { uploaded, skipped };
}
