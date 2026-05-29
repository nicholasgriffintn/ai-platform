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

export function coerceStringArray(value: unknown): string[] {
	if (Array.isArray(value)) {
		return value.filter((item): item is string => typeof item === "string");
	}

	return typeof value === "string" ? [value] : [];
}

export function coerceStringRecord(value: unknown): Record<string, string> {
	if (!isPlainObject(value)) {
		return {};
	}

	return Object.fromEntries(
		Object.entries(omitNullishValues(value)).map(([key, entryValue]) => [key, String(entryValue)]),
	);
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

export function omitNullishValues<T extends Record<string, unknown>>(
	value: T,
): Record<string, Exclude<T[keyof T], null | undefined>> {
	return Object.fromEntries(
		Object.entries(value).filter(
			([, entryValue]) => entryValue !== undefined && entryValue !== null,
		),
	) as Record<string, Exclude<T[keyof T], null | undefined>>;
}
