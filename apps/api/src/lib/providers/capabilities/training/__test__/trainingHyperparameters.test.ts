import type { TrainingModelDefinition } from "@assistant/schemas";
import { describe, expect, it } from "vitest";

import { resolveTrainingHyperparameters } from "../trainingHyperparameters";

const MODEL: TrainingModelDefinition = {
	id: "lizzy-7b",
	provider: "aws-sagemaker",
	family: "huggingface",
	name: "Lizzy 7B",
	baseModel: "flwrlabs/Lizzy-7B",
	defaultHyperparameters: {},
	trainingDataFileHyperparameter: "train_file",
	validationDataFileHyperparameter: "validation_file",
};

describe("resolveTrainingHyperparameters", () => {
	it("adds SageMaker channel file paths for concrete S3 objects", () => {
		expect(
			resolveTrainingHyperparameters({
				model: MODEL,
				trainS3Uri: "s3://bucket/datasets/train.jsonl",
				validationS3Uri: "s3://bucket/datasets/validation.jsonl",
				requestHyperparameters: { output_dir: "/opt/ml/model" },
			}),
		).toEqual({
			output_dir: "/opt/ml/model",
			train_file: "/opt/ml/input/data/train/train.jsonl",
			validation_file: "/opt/ml/input/data/test/validation.jsonl",
		});
	});

	it("does not override explicit file hyperparameters", () => {
		expect(
			resolveTrainingHyperparameters({
				model: MODEL,
				trainS3Uri: "s3://bucket/datasets/train.jsonl",
				requestHyperparameters: { train_file: "/custom/train.jsonl" },
			}),
		).toEqual({
			train_file: "/custom/train.jsonl",
		});
	});
});
