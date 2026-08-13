export type ParsedNumberInput = number | "";

export function clampPercentage(value: number): number {
	if (!Number.isFinite(value)) return 0;
	return Math.min(100, Math.max(0, value));
}

export function getBoundedPercentage(value: number, total: number): number {
	if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0) return 0;
	return clampPercentage((value / total) * 100);
}

export function parseNumberInputValue(
	value: string,
	{ integer = false }: { integer?: boolean } = {},
): ParsedNumberInput {
	if (value === "") return "";

	const parsed = integer ? Number.parseInt(value, 10) : Number(value);
	return Number.isFinite(parsed) ? parsed : "";
}

export function getNumberInputValue(value: unknown): ParsedNumberInput {
	return typeof value === "number" && Number.isFinite(value) ? value : "";
}

export function getFiniteNumberOrFallback(value: unknown, fallback: number): number {
	return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
