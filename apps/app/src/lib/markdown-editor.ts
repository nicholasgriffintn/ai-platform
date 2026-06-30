export type MarkdownEditAction = "bold" | "italic" | "heading" | "bullet-list" | "quote";

export interface MarkdownEditResult {
	content: string;
	selectionStart: number;
	selectionEnd: number;
}

export interface MarkdownOutlineItem {
	level: number;
	title: string;
	line: number;
}

export function applyMarkdownEdit(
	content: string,
	selectionStart: number,
	selectionEnd: number,
	action: MarkdownEditAction,
): MarkdownEditResult {
	const start = Math.max(0, Math.min(selectionStart, selectionEnd, content.length));
	const end = Math.max(0, Math.min(Math.max(selectionStart, selectionEnd), content.length));

	switch (action) {
		case "bold":
			return wrapSelection(content, start, end, "**");
		case "italic":
			return wrapSelection(content, start, end, "*");
		case "heading":
			return prefixActiveLine(content, start, end, "## ");
		case "bullet-list":
			return prefixSelectedLines(content, start, end, "- ");
		case "quote":
			return prefixSelectedLines(content, start, end, "> ");
	}
}

export function extractMarkdownOutline(content: string): MarkdownOutlineItem[] {
	return content.split("\n").flatMap((line, index) => {
		const match = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
		if (!match) return [];

		return [
			{
				level: match[1].length,
				title: match[2].trim(),
				line: index + 1,
			},
		];
	});
}

function wrapSelection(
	content: string,
	selectionStart: number,
	selectionEnd: number,
	marker: string,
): MarkdownEditResult {
	const selectedText = content.slice(selectionStart, selectionEnd);
	const contentWithMarkers = `${content.slice(0, selectionStart)}${marker}${selectedText}${marker}${content.slice(selectionEnd)}`;
	const markerLength = marker.length;

	return {
		content: contentWithMarkers,
		selectionStart: selectionStart + markerLength,
		selectionEnd: selectionEnd + markerLength,
	};
}

function prefixActiveLine(
	content: string,
	selectionStart: number,
	selectionEnd: number,
	prefix: string,
): MarkdownEditResult {
	const lineStart = content.lastIndexOf("\n", Math.max(selectionStart - 1, 0)) + 1;
	const lineEndIndex = content.indexOf("\n", selectionStart);
	const lineEnd = lineEndIndex === -1 ? content.length : lineEndIndex;
	const line = content.slice(lineStart, lineEnd);

	if (/^\s*#{1,6}\s/.test(line)) {
		return { content, selectionStart, selectionEnd };
	}

	return {
		content: `${content.slice(0, lineStart)}${prefix}${content.slice(lineStart)}`,
		selectionStart: selectionStart + prefix.length,
		selectionEnd: selectionEnd + prefix.length,
	};
}

function prefixSelectedLines(
	content: string,
	selectionStart: number,
	selectionEnd: number,
	prefix: string,
): MarkdownEditResult {
	const lineStart = content.lastIndexOf("\n", Math.max(selectionStart - 1, 0)) + 1;
	const lineEndIndex = content.indexOf("\n", Math.max(selectionEnd, selectionStart));
	const lineEnd = lineEndIndex === -1 ? content.length : lineEndIndex;
	const selectedBlock = content.slice(lineStart, lineEnd);
	const lines = selectedBlock.split("\n");
	const prefixedBlock = lines
		.map((line) => (line.startsWith(prefix) ? line : `${prefix}${line}`))
		.join("\n");
	const addedCharacters = prefixedBlock.length - selectedBlock.length;
	const firstLineAddedCharacters = lines[0]?.startsWith(prefix) ? 0 : prefix.length;

	return {
		content: `${content.slice(0, lineStart)}${prefixedBlock}${content.slice(lineEnd)}`,
		selectionStart: selectionStart + firstLineAddedCharacters,
		selectionEnd: selectionEnd + addedCharacters,
	};
}
