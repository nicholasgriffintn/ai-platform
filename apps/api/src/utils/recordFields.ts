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
