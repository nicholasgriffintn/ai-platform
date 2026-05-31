import { describe, expect, it } from "vitest";

import {
	getDeploymentNameInput,
	getDeploymentVersionFromRequest,
	withDeploymentVersion,
} from "./trainingDeploymentVersions.js";

describe("training deployment versions", () => {
	it("uses an explicit deployment name before a versioned fallback", () => {
		expect(
			getDeploymentNameInput({
				modelId: "lizzy-7b",
				deploymentName: "custom-lizzy",
				deploymentVersion: "v2",
			}),
		).toBe("custom-lizzy");
	});

	it("builds a versioned deployment name when no explicit name is provided", () => {
		expect(
			getDeploymentNameInput({
				modelId: "lizzy-7b",
				deploymentVersion: "v2",
			}),
		).toBe("lizzy-7b-v2");
	});

	it("reads deployment versions from stored request metadata", () => {
		expect(getDeploymentVersionFromRequest({ deploymentVersion: " v3 " })).toBe("v3");
		expect(getDeploymentVersionFromRequest({ deploymentVersion: "" })).toBeUndefined();
	});

	it("attaches deployment versions and chat model ids", () => {
		const deployment = {
			provider: "aws-sagemaker" as const,
			deploymentName: "lizzy-7b-v1",
			modelName: "lizzy-7b-v1-model",
			endpointConfigName: "lizzy-7b-v1-config",
			endpointName: "lizzy-7b-v1-endpoint",
			status: "Creating",
			modelId: "lizzy-7b",
		};

		expect(withDeploymentVersion(deployment, "v1")).toMatchObject({
			deploymentVersion: "v1",
			chatModelId: "training:aws-sagemaker:lizzy-7b-v1-endpoint",
		});
		expect(withDeploymentVersion(deployment, undefined)).toMatchObject({
			chatModelId: "training:aws-sagemaker:lizzy-7b-v1-endpoint",
		});
	});
});
