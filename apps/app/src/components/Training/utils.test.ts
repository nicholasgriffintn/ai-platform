import {
	getBedrockImportModelSourceUriError,
	type TrainingJob,
	type TrainingModelDefinition,
} from "@assistant/schemas";
import { describe, expect, it } from "vitest";

import {
	canDeployBaseTrainingModel,
	canDeployBaseTrainingModelForTarget,
	formatTrainingHyperparameters,
	getDeploymentInstanceTypeError,
	getDeployableTrainingModels,
	getDeploymentTrainingJobs,
	getTrainingEventDetail,
	isActiveTrainingDeploymentStatus,
	isActiveTrainingJobStatus,
	parseOptionalPositiveInteger,
	parseTrainingDatasetMode,
	parseTrainingHyperparameters,
} from "./utils";

const MODELS: TrainingModelDefinition[] = [
	{
		id: "nova-lite",
		provider: "aws-bedrock",
		family: "bedrock",
		name: "Amazon Nova Lite",
		baseModel: "amazon.nova-lite-v1:0",
		defaultHyperparameters: {},
	},
	{
		id: "distilbert-imdb",
		provider: "aws-sagemaker",
		family: "huggingface",
		name: "DistilBERT text classifier",
		baseModel: "distilbert/distilbert-base-uncased",
		defaultHyperparameters: {},
		inferenceImage: "123456789012.dkr.ecr.us-east-1.amazonaws.com/inference:latest",
	},
];

const JOBS: TrainingJob[] = [
	{
		provider: "aws-sagemaker",
		jobName: "distilbert-completed",
		status: "Completed",
		modelId: "distilbert-imdb",
		baseModel: "distilbert/distilbert-base-uncased",
	},
	{
		provider: "aws-sagemaker",
		jobName: "distilbert-running",
		status: "InProgress",
		modelId: "distilbert-imdb",
		baseModel: "distilbert/distilbert-base-uncased",
	},
	{
		provider: "aws-bedrock",
		jobName: "nova-completed",
		status: "Completed",
		modelId: "nova-lite",
		baseModel: "amazon.nova-lite-v1:0",
	},
];

describe("training utilities", () => {
	it("parses supported hyperparameter JSON", () => {
		expect(parseTrainingHyperparameters('{"epochs":1,"batch":"16","shuffle":true}')).toEqual({
			epochs: 1,
			batch: "16",
			shuffle: true,
		});
		expect(formatTrainingHyperparameters({ epochs: 1 })).toBe('{\n  "epochs": 1\n}');
	});

	it("rejects unsupported hyperparameter JSON", () => {
		expect(() => parseTrainingHyperparameters("[]")).toThrow("JSON object");
		expect(() => parseTrainingHyperparameters('{"nested":{"epochs":1}}')).toThrow(
			"nested must be a string, number, or boolean",
		);
	});

	it("parses form primitives without casts", () => {
		expect(parseTrainingDatasetMode("examples")).toBe("examples");
		expect(parseTrainingDatasetMode("anything-else")).toBe("s3");
		expect(parseOptionalPositiveInteger("2", "Instance count")).toBe(2);
		expect(() => parseOptionalPositiveInteger("0", "Instance count")).toThrow(
			"positive whole number",
		);
	});

	it("filters models and jobs that can be deployed", () => {
		expect(getDeployableTrainingModels(MODELS).map((model) => model.id)).toEqual([
			"distilbert-imdb",
		]);
		expect(canDeployBaseTrainingModel(MODELS[1])).toBe(true);
		expect(canDeployBaseTrainingModel(MODELS[0])).toBe(false);
		expect(canDeployBaseTrainingModelForTarget(MODELS[1], "bedrock-import")).toBe(true);
		expect(canDeployBaseTrainingModelForTarget(MODELS[0], "bedrock-import")).toBe(false);
		expect(getDeploymentTrainingJobs(JOBS, "distilbert-imdb").map((job) => job.jobName)).toEqual([
			"distilbert-completed",
		]);
	});

	it("rejects CPU endpoint instances for GPU inference images", () => {
		const model: TrainingModelDefinition = {
			...MODELS[1],
			defaultDeploymentInstanceType: "ml.g4dn.xlarge",
			inferenceImage:
				"763104351884.dkr.ecr.us-east-1.amazonaws.com/huggingface-pytorch-inference:2.6.0-transformers4.51.3-gpu-py312-cu124-ubuntu22.04",
		};

		expect(getDeploymentInstanceTypeError(model, "ml.m4.xlarge")).toContain(
			"cannot run the configured SageMaker GPU image",
		);
		expect(getDeploymentInstanceTypeError(model, "ml.g4dn.xlarge")).toBeUndefined();
	});

	it("rejects compressed SageMaker archives for Bedrock import", () => {
		expect(getBedrockImportModelSourceUriError("s3://bucket/output/model.tar.gz")).toContain(
			"not a compressed SageMaker model archive",
		);
		expect(getBedrockImportModelSourceUriError("s3://bucket/lizzy-hf-model/")).toBeUndefined();
	});

	it("surfaces useful training event metadata", () => {
		expect(
			getTrainingEventDetail({
				id: "event-1",
				provider: "aws-sagemaker",
				jobName: "endpoint",
				level: "error",
				message: "Training model deployment failed",
				metadata: { error: "UpdateEndpoint failed" },
				createdAt: "2026-05-30T22:00:00.000Z",
			}),
		).toBe("UpdateEndpoint failed");
		expect(
			getTrainingEventDetail({
				id: "event-2",
				provider: "aws-sagemaker",
				jobName: "endpoint",
				level: "info",
				message: "Training model deployment update completed",
				metadata: { endpointConfigName: "polychat-lizzy-7b-v1-4-config" },
				createdAt: "2026-05-30T22:00:00.000Z",
			}),
		).toBe("Endpoint config: polychat-lizzy-7b-v1-4-config");
	});

	it("detects deployment statuses that should keep live state refreshing", () => {
		expect(isActiveTrainingDeploymentStatus("Creating")).toBe(true);
		expect(isActiveTrainingDeploymentStatus("Updating")).toBe(true);
		expect(isActiveTrainingDeploymentStatus("InService")).toBe(false);
		expect(isActiveTrainingDeploymentStatus("Failed")).toBe(false);
	});

	it("detects job statuses that should keep live state refreshing", () => {
		expect(isActiveTrainingJobStatus("Starting")).toBe(true);
		expect(isActiveTrainingJobStatus("InProgress")).toBe(true);
		expect(isActiveTrainingJobStatus("Completed")).toBe(false);
		expect(isActiveTrainingJobStatus("Failed")).toBe(false);
	});
});
