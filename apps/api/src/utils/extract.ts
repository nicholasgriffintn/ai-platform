export function extractQuotes(text: string): string[] {
	const quoteRegex = /"([^"]*)"/g;

	const quotes: string[] = [];
	let match: RegExpExecArray | null;

	match = quoteRegex.exec(text);
	while (match !== null) {
		const quote = match[1].trim();

		if (quote.length > 10 && !quote.match(/^\d+$/)) {
			quotes.push(quote);
		}

		match = quoteRegex.exec(text);
	}

	return [...new Set(quotes)];
}
