import { describe, expect, it } from "vitest";
import type { CanvasModel } from "~/types/canvas";
import {
	buildCanvasModelOptions,
	buildCanvasModelOptionControlValues,
	collectCanvasModelOptionFields,
} from "./utils";

const imageModel: CanvasModel = {
	id: "gpt-image-2",
	name: "gpt-image-2",
	provider: "openai",
	modalities: { input: ["text", "image"], output: ["image"] },
	inputSchema: {
		fields: [
			{ name: "prompt", type: "string", required: true },
			{ name: "aspect_ratio", type: "string", enum: ["1:1", "16:9"] },
			{ name: "image", type: ["file", "string"] },
			{ name: "image_input", type: "string" },
			{ name: "quality", type: "string", enum: ["low", "medium", "high", "auto"] },
			{ name: "output_compression", type: "integer" },
			{ name: "background", type: "string", enum: ["auto", "opaque"] },
			{ name: "prompt_upsampling", type: "boolean", default: true },
			{ name: "draft", type: "boolean", default: false },
			{ name: "size", type: "string" },
		],
	},
};

const videoModel: CanvasModel = {
	id: "replicate-bytedance-seedance-2-0",
	name: "Seedance 2.0",
	provider: "replicate",
	modalities: { input: ["text", "image", "video", "audio"], output: ["video"] },
	inputSchema: {
		fields: [
			{ name: "prompt", type: "string", required: true },
			{ name: "negative_prompt", type: "string" },
			{ name: "image", type: ["file", "string"] },
			{ name: "reference_images", type: "array" },
			{ name: "duration", type: "integer" },
			{ name: "generate_audio", type: "boolean", default: true },
		],
	},
};

describe("Canvas utils", () => {
	it("collects configurable model option fields from input schemas", () => {
		const fields = collectCanvasModelOptionFields([imageModel]);

		expect(fields.map((field) => field.name)).toEqual([
			"aspect_ratio",
			"quality",
			"output_compression",
			"background",
			"prompt_upsampling",
			"draft",
			"size",
		]);
	});

	it("builds typed model options from control values", () => {
		const fields = collectCanvasModelOptionFields([imageModel]);

		const options = buildCanvasModelOptions(fields, {
			quality: "high",
			output_compression: "60",
			background: "",
			size: "2048x2048",
		});

		expect(options).toEqual({
			quality: "high",
			output_compression: 60,
			size: "2048x2048",
		});
	});

	it("uses boolean defaults for controls and sends false overrides for true defaults", () => {
		const fields = collectCanvasModelOptionFields([imageModel]);

		expect(buildCanvasModelOptionControlValues(fields, {})).toMatchObject({
			prompt_upsampling: true,
		});

		const options = buildCanvasModelOptions(fields, {
			prompt_upsampling: false,
			draft: false,
		});

		expect(options).toEqual({
			prompt_upsampling: false,
		});
	});

	it("collects schema-driven video fields as options", () => {
		const fields = collectCanvasModelOptionFields([videoModel], {
			includeReservedFields: true,
			includeReferenceFields: true,
		});

		expect(fields.map((field) => field.name)).toEqual([
			"negative_prompt",
			"image",
			"reference_images",
			"duration",
			"generate_audio",
		]);
	});

	it("builds array model options from newline-delimited values", () => {
		const fields = collectCanvasModelOptionFields([videoModel], {
			includeReservedFields: true,
			includeReferenceFields: true,
		});

		const options = buildCanvasModelOptions(fields, {
			reference_images: "https://example.com/one.png\nhttps://example.com/two.png",
			duration: "5",
			generate_audio: false,
		});

		expect(options).toEqual({
			reference_images: ["https://example.com/one.png", "https://example.com/two.png"],
			duration: 5,
			generate_audio: false,
		});
	});
});
