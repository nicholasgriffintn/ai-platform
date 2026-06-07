import { isRecord } from "~/utils/objects";

export function getStringParam(params: Record<string, unknown>, key: string): string | undefined {
	const value = params[key];
	return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function getNumberParam(params: Record<string, unknown>, key: string): number | undefined {
	const value = params[key];
	return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function getRecordParam(
	params: Record<string, unknown>,
	key: string,
): Record<string, unknown> | undefined {
	return isRecord(params[key]) ? params[key] : undefined;
}

export function limitPositiveInteger(
	value: number | undefined,
	fallback: number,
	max: number,
): number {
	if (!value) {
		return fallback;
	}

	return Math.min(Math.max(Math.floor(value), 1), max);
}
