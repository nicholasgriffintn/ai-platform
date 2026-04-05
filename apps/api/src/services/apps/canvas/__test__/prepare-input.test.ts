import { describe, expect, it } from "vitest";
import type { ModelConfigItem } from "~/types";

import { prepareCanvasInputForModel } from "../prepare-input";

const imageModel: ModelConfigItem = {
	matchingModel: "test-image-model",
	provider: "replicate",
	modalities: { input: ["text"], output: ["image"] },
	inputSchema: {
		fields: [
			{ name: "prompt", type: "string", required: true },
			{ name: "aspect_ratio", type: "string", enum: ["1:1", "16:9"] },
			{ name: "resolution", type: "string", enum: ["0.5MP", "1 MP"] },
			{ name: "input_reference", type: ["file", "string"] },
		],
	},
};

describe("prepareCanvasInputForModel", () => {
	it("maps a Canvas request into schema-compatible model input", () => {
		const result = prepareCanvasInputForModel({
			model: imageModel,
			request: {
				mode: "image",
				prompt: "A portrait of a fox in winter",
				aspectRatio: "16:9",
				resolution: "0.5 MP",
				referenceImages: ["https://example.com/ref.png"],
			},
		});

		expect(result).toEqual({
			prompt: "A portrait of a fox in winter",
			aspect_ratio: "16:9",
			resolution: "0.5MP",
			input_reference: "https://example.com/ref.png",
		});
	});

	it("throws when required schema fields are missing", () => {
		const modelWithRequiredReference: ModelConfigItem = {
			...imageModel,
			inputSchema: {
				fields: [
					{ name: "prompt", type: "string", required: true },
					{ name: "input_reference", type: ["file", "string"], required: true },
				],
			},
		};

		expect(() =>
			prepareCanvasInputForModel({
				model: modelWithRequiredReference,
				request: {
					mode: "image",
					prompt: "A cat",
				},
			}),
		).toThrow("Missing required input");
	});

	it("maps image references to a single value for file/string reference fields", () => {
		const modelWithScalarInputImages: ModelConfigItem = {
			...imageModel,
			inputSchema: {
				fields: [
					{ name: "prompt", type: "string", required: true },
					{ name: "input_images", type: ["file", "string"] },
				],
			},
		};

		const result = prepareCanvasInputForModel({
			model: modelWithScalarInputImages,
			request: {
				mode: "image",
				prompt: "A cat",
				referenceImages: [
					"https://example.com/ref-1.png",
					"https://example.com/ref-2.png",
				],
			},
		});

		expect(result).toEqual({
			prompt: "A cat",
			input_images: "https://example.com/ref-1.png",
		});
	});

	it("maps image references to arrays for array reference fields", () => {
		const modelWithArrayInputImages: ModelConfigItem = {
			...imageModel,
			inputSchema: {
				fields: [
					{ name: "prompt", type: "string", required: true },
					{ name: "input_images", type: "array" },
				],
			},
		};

		const result = prepareCanvasInputForModel({
			model: modelWithArrayInputImages,
			request: {
				mode: "image",
				prompt: "A cat",
				referenceImages: [
					"https://example.com/ref-1.png",
					"https://example.com/ref-2.png",
				],
			},
		});

		expect(result).toEqual({
			prompt: "A cat",
			input_images: [
				"https://example.com/ref-1.png",
				"https://example.com/ref-2.png",
			],
		});
	});
});
