export function escapeHtml(value: string): string {
	return value.replace(
		/[&<>'"]/g,
		(character) =>
			({
				"&": "&amp;",
				"<": "&lt;",
				">": "&gt;",
				"'": "&#39;",
				'"': "&quot;",
			})[character] ?? character,
	);
}
