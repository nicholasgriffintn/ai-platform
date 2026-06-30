/**
 * Process custom XML tags in markdown content, converting them to markdown format
 * Example: <custom_tag>content</custom_tag> becomes **Custom Tag**\n\ncontent\n\n
 */
export function processCustomXmlTags(text: string): string {
	const codeFenceRegex = /```[\s\S]*?```/g;
	const fences: string[] = [];
	const placeholderPrefix = "<<CODE_BLOCK_";
	let idx = 0;

	const textNoFences = text.replace(codeFenceRegex, (match) => {
		const placeholder = `${placeholderPrefix}${idx}>>`;
		fences[idx++] = match;
		return placeholder;
	});

	const xmlTagRegex = /<([A-Za-z][\w-]*)\b[^>]*>([\s\S]*?)<\/\1>/g;
	const processed = textNoFences.replace(xmlTagRegex, (_match, tagName, inner) => {
		const title = tagName
			.split(/[_-]/)
			.map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
			.join(" ");
		return `**${title}**\n\n${inner}\n\n`;
	});

	let result = processed;
	fences.forEach((fence, i) => {
		const placeholder = `${placeholderPrefix}${i}>>`;
		result = result.replace(placeholder, fence);
	});

	return result;
}

/**
 * Splits content by artifact markers and returns the parts
 */
export function splitContentByArtifacts(content: string): {
	textParts: string[];
	identifiers: string[];
} {
	const parts = content.split(/\[\[ARTIFACT:([^\]]+)\]\]/);
	const textParts: string[] = [];
	const identifiers: string[] = [];

	for (let i = 0; i < parts.length; i++) {
		if (i % 2 === 0) {
			textParts.push(parts[i]);
		} else {
			identifiers.push(parts[i]);
		}
	}

	return { textParts, identifiers };
}
