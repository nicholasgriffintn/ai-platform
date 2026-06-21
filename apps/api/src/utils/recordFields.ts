import { isRecord } from "./objects";

export function readRecordField(value: unknown, fieldName: string): unknown {
	if (!isRecord(value)) {
		return undefined;
	}

	return value[fieldName];
}

export function readStringField(value: unknown, fieldName: string): string | undefined {
	const field = readRecordField(value, fieldName);
	return typeof field === "string" ? field : undefined;
}

export function readNumberField(value: unknown, fieldName: string): number | undefined {
	const field = readRecordField(value, fieldName);
	return typeof field === "number" && Number.isFinite(field) ? field : undefined;
}

export function readNumberFieldAlias(
	value: unknown,
	fieldNames: readonly string[],
): number | undefined {
	for (const fieldName of fieldNames) {
		const field = readNumberField(value, fieldName);
		if (field !== undefined) {
			return field;
		}
	}

	return undefined;
}
