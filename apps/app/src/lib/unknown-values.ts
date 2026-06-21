export function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function getStringProperty(value: unknown, key: string): string | undefined {
	if (!isRecord(value)) {
		return undefined;
	}

	const property = value[key];
	return typeof property === "string" ? property : undefined;
}

export function formatUnknownValue(value: unknown): string {
	if (value === null || value === undefined) {
		return "";
	}

	if (typeof value === "string") {
		return value;
	}

	if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
		return String(value);
	}

	try {
		return JSON.stringify(value, null, 2) ?? String(value);
	} catch {
		return String(value);
	}
}
