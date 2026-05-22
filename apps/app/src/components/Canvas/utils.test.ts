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
});
