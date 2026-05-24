export function joinNonEmptyStrings(
	parts: Array<string | null | undefined>,
	separator = " ",
): string {
	return parts
		.map((part) => part?.trim())
		.filter((part): part is string => Boolean(part))
		.join(separator);
}
