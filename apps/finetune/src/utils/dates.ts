export function toDate(value: unknown): Date | undefined {
	if (value instanceof Date) return value;
	if (typeof value === "number") return new Date(value * 1000);
	if (typeof value === "string") return new Date(value);
	return undefined;
}
