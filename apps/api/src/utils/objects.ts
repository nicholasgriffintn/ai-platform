export function isPlainObject(value: unknown): value is Record<string, unknown> {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		return false;
	}

	const prototype = Object.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isObjectOrArray(value: unknown): value is Record<string, unknown> | unknown[] {
	return isRecord(value) || Array.isArray(value);
}

export function isStringArray(value: unknown): value is string[] {
	return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export function omitUndefinedValues<T>(value: T): T {
	if (Array.isArray(value)) {
		return value.map((item) => (item === undefined ? null : omitUndefinedValues(item))) as T;
	}

	if (!isPlainObject(value)) {
		return value;
	}

	const entries = Object.entries(value)
		.filter(([, entryValue]) => entryValue !== undefined)
		.map(([entryKey, entryValue]) => [entryKey, omitUndefinedValues(entryValue)]);

	return Object.fromEntries(entries) as T;
}
