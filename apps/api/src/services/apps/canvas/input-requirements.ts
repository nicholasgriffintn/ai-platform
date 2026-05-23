import type { ModelConfigItem } from "~/types";
import type { CanvasGenerationInput } from "./types";

const canvasReferenceFieldNames = new Set([
	"input_images",
	"reference_images",
	"input_references",
	"input_reference",
	"input_image",
	"image_input",
	"image_inputs",
	"image",
	"first_frame_image",
	"last_frame",
	"last_frame_image",
	"reference_audios",
	"reference_videos",
	"start_image",
	"end_image",
]);

export function isCanvasReferenceFieldName(fieldName: string): boolean {
	return canvasReferenceFieldNames.has(fieldName.toLowerCase());
}

function getRequiredReferenceFields(model: ModelConfigItem): string[] {
	const fields = model.inputSchema?.fields ?? [];
	return fields
		.filter((field) => field.required && isCanvasReferenceFieldName(field.name))
		.map((field) => field.name);
}

export function modelRequiresCanvasReferenceImage(model: ModelConfigItem): boolean {
	return getRequiredReferenceFields(model).length > 0;
}

export function validateCanvasModelInputRequirements({
	model,
	request,
}: {
	model: ModelConfigItem;
	request: CanvasGenerationInput;
}): string | null {
	const requiredReferenceFields = getRequiredReferenceFields(model);
	if (requiredReferenceFields.length === 0) {
		return null;
	}

	const hasReferences = (request.referenceImages ?? []).some((value) => Boolean(value?.trim()));
	const hasModelOptionReference = requiredReferenceFields.some((fieldName) => {
		const value = request.modelOptions?.[fieldName];
		if (Array.isArray(value)) {
			return value.some((entry) => Boolean(entry.trim()));
		}
		return typeof value === "string" && value.trim().length > 0;
	});

	if (hasReferences || hasModelOptionReference) {
		return null;
	}

	return `Model ${model.name ?? model.matchingModel} requires at least one reference image.`;
}
