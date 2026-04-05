import type {
	InputSchemaInputFieldDescriptor,
	InputSchemaInputFieldType,
	ModelConfigItem,
} from "~/types";
import {
	buildInputSchemaInput,
	type InputSchemaBuildParameters,
} from "~/utils/inputSchema";
import type { CanvasGenerationInput } from "./types";
import { isCanvasReferenceFieldName } from "./input-requirements";

function isAllowedEnumValue(
	field: InputSchemaInputFieldDescriptor | undefined,
	value: string | undefined,
): string | undefined {
	if (!field || !value) {
		return undefined;
	}

	if (!field.enum?.length) {
		return value;
	}

	const enumValues = new Set(
		field.enum.filter((entry): entry is string => typeof entry === "string"),
	);

	if (enumValues.has(value)) {
		return value;
	}

	const aliases: Record<string, string[]> = {
		"0.5 MP": ["0.5MP"],
		"0.5MP": ["0.5 MP"],
	};

	for (const alias of aliases[value] ?? []) {
		if (enumValues.has(alias)) {
			return alias;
		}
	}

	return undefined;
}

function getFieldTypes(
	field: InputSchemaInputFieldDescriptor,
): InputSchemaInputFieldType[] {
	return Array.isArray(field.type) ? field.type : [field.type];
}

function isReferenceField(fieldName: string): boolean {
	return isCanvasReferenceFieldName(fieldName);
}

function getReferenceFieldValue(
	field: InputSchemaInputFieldDescriptor,
	referenceImages: string[],
): unknown {
	if (referenceImages.length === 0) {
		return undefined;
	}

	const fieldTypes = getFieldTypes(field);
	const fieldName = field.name.toLowerCase();

	if (fieldTypes.includes("array")) {
		return referenceImages;
	}

	if (
		fieldName === "last_frame" ||
		fieldName === "last_frame_image" ||
		fieldName === "end_image"
	) {
		return referenceImages[1];
	}

	return referenceImages[0];
}

function buildCanvasInputSource(
	request: CanvasGenerationInput,
	model: ModelConfigItem,
): Record<string, unknown> {
	const fields = model.inputSchema?.fields ?? [];
	const aspectRatioField = fields.find(
		(field) => field.name === "aspect_ratio",
	);
	const resolutionField = fields.find((field) => field.name === "resolution");
	const referenceImages = (request.referenceImages ?? []).filter(Boolean);

	const input: Record<string, unknown> = {
		prompt: request.prompt,
		negative_prompt: request.negativePrompt,
		width: request.width,
		height: request.height,
		duration: request.durationSeconds,
		seconds: request.durationSeconds,
		generate_audio: request.generateAudio,
	};

	for (const field of fields) {
		const fieldName = field.name.toLowerCase();
		if (!isReferenceField(fieldName)) {
			continue;
		}

		const value = getReferenceFieldValue(field, referenceImages);
		if (value === undefined) {
			continue;
		}

		input[field.name] = value;
	}

	const resolvedAspectRatio = isAllowedEnumValue(
		aspectRatioField,
		request.aspectRatio,
	);
	if (resolvedAspectRatio) {
		input.aspect_ratio = resolvedAspectRatio;
	}

	const resolvedResolution = isAllowedEnumValue(
		resolutionField,
		request.resolution,
	);
	if (resolvedResolution) {
		input.resolution = resolvedResolution;
	}

	return Object.fromEntries(
		Object.entries(input).filter(([, value]) => value !== undefined),
	);
}

export function prepareCanvasInputForModel({
	request,
	model,
}: {
	request: CanvasGenerationInput;
	model: ModelConfigItem;
}): Record<string, unknown> {
	const sourceInput = buildCanvasInputSource(request, model);

	const params = {
		messages: [
			{
				role: "user",
				content: request.prompt,
			},
		],
		body: {
			input: sourceInput,
		},
	} satisfies InputSchemaBuildParameters;

	const built = buildInputSchemaInput(params, model).input;

	if (typeof built === "string") {
		return {
			prompt: built,
		};
	}

	return built;
}
