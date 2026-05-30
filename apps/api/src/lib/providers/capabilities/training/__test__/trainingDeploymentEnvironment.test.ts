import type { TrainingModelDefinition } from "~/types/training";
import { describe, expect, it } from "vitest";

import { resolveTrainingDeploymentEnvironment } from "../trainingDeploymentEnvironment";

const MODEL: TrainingModelDefinition = {
	id: "lizzy-7b",
	provider: "aws-sagemaker",
	family: "huggingface",
	name: "Lizzy 7B",
	baseModel: "flwrlabs/Lizzy-7B",
	defaultHyperparameters: {},
	defaultDeploymentEnvironment: {
		HF_TASK: "text-generation",
		HF_TRUST_REMOTE_CODE: "True",
	},
};

describe("resolveTrainingDeploymentEnvironment", () => {
	it("adds HF_MODEL_ID when deploying a Hugging Face base model from the Hub", () => {
		expect(resolveTrainingDeploymentEnvironment({ model: MODEL, request: {} })).toEqual({
			HF_MODEL_ID: "flwrlabs/Lizzy-7B",
			HF_TASK: "text-generation",
			HF_TRUST_REMOTE_CODE: "True",
		});
	});

	it("does not add HF_MODEL_ID for fine-tuned artifact deployments", () => {
		expect(
			resolveTrainingDeploymentEnvironment({
				model: MODEL,
				request: { modelArtifactsS3Uri: "s3://bucket/model.tar.gz" },
			}),
		).toEqual({
			HF_TASK: "text-generation",
			HF_TRUST_REMOTE_CODE: "True",
		});
	});

	it("keeps explicit HF_MODEL_ID overrides", () => {
		expect(
			resolveTrainingDeploymentEnvironment({
				model: MODEL,
				request: { environment: { HF_MODEL_ID: "custom/model", HF_TASK: "text-generation" } },
			}),
		).toEqual({
			HF_MODEL_ID: "custom/model",
			HF_TASK: "text-generation",
			HF_TRUST_REMOTE_CODE: "True",
		});
	});

	it("normalises boolean-style HF_TRUST_REMOTE_CODE overrides for the inference toolkit", () => {
		expect(
			resolveTrainingDeploymentEnvironment({
				model: MODEL,
				request: { environment: { HF_TRUST_REMOTE_CODE: "true" } },
			}),
		).toEqual({
			HF_MODEL_ID: "flwrlabs/Lizzy-7B",
			HF_TASK: "text-generation",
			HF_TRUST_REMOTE_CODE: "True",
		});
	});
});
