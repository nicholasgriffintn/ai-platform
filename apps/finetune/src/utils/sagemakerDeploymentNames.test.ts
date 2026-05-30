import { describe, expect, it } from "vitest";

import { getSageMakerDeploymentNames } from "./sagemakerDeploymentNames.js";

describe("getSageMakerDeploymentNames", () => {
	it("derives stable SageMaker resource names from a deployment name", () => {
		expect(getSageMakerDeploymentNames("lizzy-7b")).toEqual({
			deploymentName: "lizzy-7b",
			modelName: "lizzy-7b-model",
			endpointConfigName: "lizzy-7b-config",
			endpointName: "lizzy-7b-endpoint",
		});
	});

	it("sanitises names before adding SageMaker suffixes", () => {
		expect(getSageMakerDeploymentNames("Lizzy 7B!").deploymentName).toBe("Lizzy-7B");
	});

	it("keeps endpoints stable while versioning model resources", () => {
		expect(getSageMakerDeploymentNames("polychat-lizzy-7b", { resourceVersion: "1.1" })).toEqual({
			deploymentName: "polychat-lizzy-7b",
			modelName: "polychat-lizzy-7b-1-1-model",
			endpointConfigName: "polychat-lizzy-7b-1-1-config",
			endpointName: "polychat-lizzy-7b-endpoint",
		});
	});
});
