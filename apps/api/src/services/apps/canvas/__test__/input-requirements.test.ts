import { describe, expect, it } from "vitest";
import type { ModelConfigItem } from "~/types";
import {
	modelRequiresCanvasReferenceImage,
	validateCanvasModelInputRequirements,
} from "../input-requirements";

describe("canvas input requirements", () => {
	it("detects when a model requires a reference image", () => {
		const model: ModelConfigItem = {
			matchingModel: "qwen/qwen-image-edit-2511",
			provider: "replicate",
			modalities: { input: ["text", "image"], output: ["image"] },
			inputSchema: {
				fields: [
					{ name: "prompt", type: "string", required: true },
					{ name: "image", type: "array", required: true },
				],
			},
		};

		expect(modelRequiresCanvasReferenceImage(model)).toBe(true);
		expect(
			validateCanvasModelInputRequirements({
				model,
				request: {
					mode: "image",
					prompt: "Edit this image",
				},
			}),
		).toContain("requires at least one reference image");
	});

	it("passes when required references are provided", () => {
		const model: ModelConfigItem = {
			matchingModel: "qwen/qwen-image-edit-2511",
			provider: "replicate",
			modalities: { input: ["text", "image"], output: ["image"] },
			inputSchema: {
				fields: [
					{ name: "prompt", type: "string", required: true },
					{ name: "image", type: "array", required: true },
				],
			},
		};

		expect(
			validateCanvasModelInputRequirements({
				model,
				request: {
					mode: "image",
					prompt: "Edit this image",
					referenceImages: ["https://example.com/ref.png"],
				},
			}),
		).toBeNull();
	});

	it("passes when required references are provided through model options", () => {
		const model: ModelConfigItem = {
			matchingModel: "test-video-model",
			provider: "replicate",
			modalities: { input: ["text", "image"], output: ["video"] },
			inputSchema: {
				fields: [
					{ name: "prompt", type: "string", required: true },
					{ name: "reference_images", type: "array", required: true },
				],
			},
		};

		expect(
			validateCanvasModelInputRequirements({
				model,
				request: {
					mode: "video",
					prompt: "Animate this scene",
					modelOptions: {
						reference_images: ["https://example.com/ref.png"],
					},
				},
			}),
		).toBeNull();
	});
});
