import type { FineTuningJob, FineTuningModelDefinition } from "@assistant/schemas";
import { describe, expect, it } from "vitest";

import {
	canDeployBaseTrainingModel,
	formatTrainingHyperparameters,
	getDeployableTrainingModels,
	getDeploymentTrainingJobs,
	parseOptionalPositiveInteger,
	parseTrainingDatasetMode,
	parseTrainingHyperparameters,
} from "./utils";

const MODELS: FineTuningModelDefinition[] = [
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

const JOBS: FineTuningJob[] = [
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

describe("finetuning utilities", () => {
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
		expect(getDeploymentTrainingJobs(JOBS, "distilbert-imdb").map((job) => job.jobName)).toEqual([
			"distilbert-completed",
		]);
	});
});
