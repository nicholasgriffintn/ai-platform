export function verifyQuotes(
	originalArticle: string,
	quotes: string[],
): { verified: boolean; missingQuotes: string[] } {
	const normalizeText = (text: string) =>
		text
			.toLowerCase()
			.replace(/[^\w\s]/g, "")
			.replace(/\s+/g, " ")
			.trim();

	const normalizedArticle = normalizeText(originalArticle);

	const missingQuotes = quotes.filter((quote) => {
		const normalizedQuote = normalizeText(quote);
		return !normalizedArticle.includes(normalizedQuote);
	});

	return {
		verified: missingQuotes.length === 0,
		missingQuotes,
	};
}
