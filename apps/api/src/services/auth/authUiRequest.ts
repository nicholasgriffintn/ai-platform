import { getStringRecordValue, isRecord } from "~/utils/objects";

export function requireAuthUiRequest(value: unknown): Record<string, unknown> {
	if (!isRecord(value)) {
		throw new Error("The authentication request is invalid.");
	}
	return value;
}

export function requireAuthUiValue(value: Record<string, unknown>, name: string): string {
	return requireAuthUiString(requireAuthUiValues(value), name);
}

export function requireAuthUiValues(value: Record<string, unknown>): Record<string, unknown> {
	return requireAuthUiRequest(value.values);
}

export function requireAuthUiString(value: Record<string, unknown>, name: string): string {
	const result = getStringRecordValue(value, name);
	if (!result) {
		throw new Error(`Authentication value ${name} is required.`);
	}
	return result;
}
