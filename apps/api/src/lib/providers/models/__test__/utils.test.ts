import { describe, expect, it } from "vitest";

import type { ModelModalities } from "@assistant/schemas";
import {
	getModelInputModalities,
	getModelOutputModalities,
	hasModelTextOutput,
	producesNonTextPrimaryOutput,
} from "../utils";

describe("model config utilities", () => {
	it("falls back to text input and output modalities", () => {
		const model = {};

		expect(getModelInputModalities(model)).toEqual(["text"]);
		expect(getModelOutputModalities(model)).toEqual(["text"]);
		expect(hasModelTextOutput(model)).toBe(true);
	});

	it("uses input modalities when output modalities are omitted", () => {
		const model = {
			modalities: { input: ["image"] },
		} satisfies { modalities: ModelModalities };

		expect(getModelOutputModalities(model)).toEqual(["image"]);
		expect(hasModelTextOutput(model)).toBe(false);
		expect(producesNonTextPrimaryOutput(model)).toBe(true);
	});

	it("identifies mixed text/image output as text-capable", () => {
		const model = {
			modalities: { input: ["text"], output: ["text", "image"] },
		} satisfies { modalities: ModelModalities };

		expect(hasModelTextOutput(model)).toBe(true);
		expect(producesNonTextPrimaryOutput(model)).toBe(false);
	});
});
