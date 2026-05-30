export function stringifyEntries(
	input: Record<string, string | number | boolean | undefined>,
): Record<string, string> {
	return Object.fromEntries(
		Object.entries(input)
			.filter((entry): entry is [string, string | number | boolean] => entry[1] !== undefined)
			.map(([key, value]) => [key, String(value)]),
	);
}

export function parseJsonValue(value: unknown): unknown {
	if (typeof value !== "string" || value.length === 0) {
		return undefined;
	}

	try {
		return JSON.parse(value);
	} catch {
		return undefined;
	}
}
