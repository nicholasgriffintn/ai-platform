import type { ChatCompletionParameters, ModelConfigItem } from "~/types";
import { buildInputSchemaInput } from "~/utils/inputSchema";

export interface OpenAIImageParams {
	model: string;
	prompt: string;
	size?: string;
	n?: number;
	quality?: string;
	background?: string;
	moderation?: string;
	output_format?: string;
	output_compression?: number;
}

export const OPENAI_IMAGE_PARAMETER_NAMES = new Set([
	"prompt",
	"size",
	"n",
	"quality",
	"background",
	"moderation",
	"output_format",
	"output_compression",
]);

export function getOpenAIImageRequestInput(
	params: ChatCompletionParameters,
	modelConfig: ModelConfigItem,
): Partial<OpenAIImageParams> {
	if (!params.body?.input || !modelConfig.inputSchema?.fields?.length) {
		return {};
	}

	const { input } = buildInputSchemaInput(params, modelConfig);

	if (typeof input === "string") {
		return input ? { prompt: input } : {};
	}

	const imageInput: Partial<OpenAIImageParams> = {};

	for (const [name, value] of Object.entries(input)) {
		if (!OPENAI_IMAGE_PARAMETER_NAMES.has(name) || value === undefined) {
			continue;
		}

		switch (name) {
			case "prompt":
				if (typeof value === "string") imageInput.prompt = value;
				break;
			case "size":
				if (typeof value === "string") imageInput.size = value;
				break;
			case "n":
				if (typeof value === "number") imageInput.n = value;
				break;
			case "quality":
				if (typeof value === "string") imageInput.quality = value;
				break;
			case "background":
				if (typeof value === "string") imageInput.background = value;
				break;
			case "moderation":
				if (typeof value === "string") imageInput.moderation = value;
				break;
			case "output_format":
				if (typeof value === "string") imageInput.output_format = value;
				break;
			case "output_compression":
				if (typeof value === "number") imageInput.output_compression = value;
				break;
		}
	}

	return imageInput;
}
