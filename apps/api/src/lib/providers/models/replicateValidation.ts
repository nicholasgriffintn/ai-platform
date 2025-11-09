import type { ReplicateInputSchemaDescriptor } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

type ReplicateFieldType =
	| "string"
	| "number"
	| "integer"
	| "boolean"
	| "file"
	| "array"
	| "object";

function coerceTypeList(type: ReplicateFieldType | ReplicateFieldType[]) {
	return Array.isArray(type) ? type : [type];
}

function describeType(value: unknown): string {
	if (Array.isArray(value)) {
		return "array";
	}

	if (value === null) {
		return "null";
	}

	return typeof value;
}

function isBlobLike(value: unknown): boolean {
	if (!value) {
		return false;
	}

	if (typeof Blob !== "undefined" && value instanceof Blob) {
		return true;
	}

	if (typeof File !== "undefined" && value instanceof File) {
		return true;
	}

	if (typeof value === "object") {
		return (
			Object.prototype.hasOwnProperty.call(value, "url") ||
			Object.prototype.hasOwnProperty.call(value, "data")
		);
	}

	return false;
}

function valueMatchesType(value: unknown, type: ReplicateFieldType): boolean {
	switch (type) {
		case "string":
			return typeof value === "string";
		case "number":
			return typeof value === "number" && Number.isFinite(value as number);
		case "integer":
			return (
				typeof value === "number" &&
				Number.isFinite(value as number) &&
				Number.isInteger(value as number)
			);
		case "boolean":
			return typeof value === "boolean";
		case "file":
			return typeof value === "string" || isBlobLike(value);
		case "array":
			return Array.isArray(value);
		case "object":
			return !!value && typeof value === "object" && !Array.isArray(value);
		default:
			return false;
	}
}

export function validateReplicatePayload({
	payload,
	schema,
	modelName,
}: {
	payload: Record<string, unknown>;
	schema?: ReplicateInputSchemaDescriptor | null;
	modelName: string;
}): void {
	if (!schema?.fields?.length) {
		return;
	}

	for (const field of schema.fields) {
		const allowedTypes = coerceTypeList(field.type as ReplicateFieldType);
		const value = payload[field.name];

		if (
			value === undefined ||
			value === null ||
			(allowedTypes.includes("string") &&
				typeof value === "string" &&
				value.trim() === "")
		) {
			if (field.required) {
				throw new AssistantError(
					`Missing required field "${field.name}" for ${modelName}.`,
					ErrorType.PARAMS_ERROR,
				);
			}

			continue;
		}

		if (!allowedTypes.some((type) => valueMatchesType(value, type))) {
			const expected = allowedTypes.join(" or ");
			const actual = describeType(value);

			throw new AssistantError(
				`Invalid type for field "${field.name}" on ${modelName}. Expected ${expected} but received ${actual}.`,
				ErrorType.PARAMS_ERROR,
			);
		}

		if (field.enum && field.enum.length > 0) {
			const enumValues = new Set(field.enum as Array<string | number>);
			const normalizedValue = value as string | number;

			if (!enumValues.has(normalizedValue)) {
				throw new AssistantError(
					`Invalid value "${normalizedValue}" for field "${field.name}" on ${modelName}. Allowed values: ${field.enum.join(", ")}.`,
					ErrorType.PARAMS_ERROR,
				);
			}
		}
	}
}
