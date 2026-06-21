export type ComposerCommandTrigger = "/" | "@";

export interface ComposerDirectiveQuery {
	trigger: ComposerCommandTrigger;
	query: string;
	start: number;
	end: number;
}

const COMMAND_TRIGGER_PATTERN = /(^|\s)([/@][^\s]*)$/;

export function getComposerDirectiveQuery(
	input: string,
	cursorPosition: number,
): ComposerDirectiveQuery | null {
	const beforeCursor = input.slice(0, cursorPosition);
	const match = beforeCursor.match(COMMAND_TRIGGER_PATTERN);
	if (!match?.[2]) {
		return null;
	}

	const token = match[2];
	const start = beforeCursor.length - token.length;
	const tokenSuffix = input.slice(cursorPosition).match(/^[^\s]*/)?.[0] ?? "";
	return {
		trigger: token[0] as ComposerCommandTrigger,
		query: token.slice(1).toLowerCase(),
		start,
		end: cursorPosition + tokenSuffix.length,
	};
}

export function removeComposerDirective(input: string, directive: ComposerDirectiveQuery): string {
	return replaceComposerDirective(input, directive, "");
}

export function replaceComposerDirective(
	input: string,
	directive: ComposerDirectiveQuery,
	replacement: string,
): string {
	return replaceComposerDirectiveWithCursor(input, directive, replacement).input;
}

export function replaceComposerDirectiveWithCursor(
	input: string,
	directive: ComposerDirectiveQuery,
	replacement: string,
	cursorOffset?: number,
): { input: string; cursorPosition: number } {
	const before = input.slice(0, directive.start).replace(/\s+$/, "");
	const after = input.slice(directive.end).replace(/^\s+/, "");
	const value = replacement.trim();
	const replacementCursorPosition =
		before.length + (before && value ? 1 : 0) + (cursorOffset ?? value.length);

	if (!before && !value) {
		return { input: after, cursorPosition: 0 };
	}
	if (!after && !value) {
		return { input: before, cursorPosition: before.length };
	}
	return {
		input: [before, value, after].filter(Boolean).join(" "),
		cursorPosition: replacementCursorPosition,
	};
}

export function matchesComposerCommand(query: string, values: Array<string | undefined>): boolean {
	const normalizedQuery = query.trim().toLowerCase();
	if (!normalizedQuery) {
		return true;
	}

	return values.some((value) => value?.toLowerCase().includes(normalizedQuery));
}
