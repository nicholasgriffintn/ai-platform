import { describe, expect, it } from "vitest";

import { isSageMakerAlreadyExistsError, SageMakerApiError } from "./sagemaker.js";

describe("SageMaker errors", () => {
	it("detects existing-resource create failures", () => {
		const error = new SageMakerApiError(
			"Bad Request",
			400,
			'Cannot create already existing model "example-model".',
		);

		expect(isSageMakerAlreadyExistsError(error)).toBe(true);
	});

	it("does not treat quota failures as existing resources", () => {
		const error = new SageMakerApiError(
			"Bad Request",
			400,
			"The account-level service limit is 0 Instances.",
		);

		expect(isSageMakerAlreadyExistsError(error)).toBe(false);
	});
});
