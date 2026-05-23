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
	return {
		trigger: token[0] as ComposerCommandTrigger,
		query: token.slice(1).toLowerCase(),
		start,
		end: cursorPosition,
	};
}

export function removeComposerDirective(input: string, directive: ComposerDirectiveQuery): string {
	const before = input.slice(0, directive.start).replace(/\s+$/, "");
	const after = input.slice(directive.end).replace(/^\s+/, "");

	if (!before) {
		return after;
	}
	if (!after) {
		return before;
	}
	return `${before} ${after}`;
}

export function matchesComposerCommand(query: string, values: Array<string | undefined>): boolean {
	const normalizedQuery = query.trim().toLowerCase();
	if (!normalizedQuery) {
		return true;
	}

	return values.some((value) => value?.toLowerCase().includes(normalizedQuery));
}
