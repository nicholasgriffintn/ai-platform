export type ParsedNumberInput = number | "";

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
