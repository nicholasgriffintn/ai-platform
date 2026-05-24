export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readOptionalString(value: unknown): string | undefined {
	return typeof value === "string" ? value : undefined;
}
