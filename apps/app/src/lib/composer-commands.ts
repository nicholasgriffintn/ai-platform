export type ComposerCommandTrigger = "/" | "@";

export interface ComposerDirectiveQuery {
	trigger: ComposerCommandTrigger;
	query: string;
	start: number;
	end: number;
}

export interface ComposerDirectiveIgnoredRange {
	start: number;
	end: number;
}

export interface ComposerDirectiveQueryOptions {
	ignoredRanges?: ComposerDirectiveIgnoredRange[];
}

export interface ComposerDirectiveReplacement {
	input: string;
	cursorPosition: number;
	replacementStart: number;
	replacementEnd: number;
}

interface ComposerDirectiveReplacementOptions {
	cursorOffset?: number;
	appendTrailingSpace?: boolean;
}

const COMMAND_TRIGGER_PATTERN = /(^|\s)([/@][^\s]*)$/;

export function getComposerDirectiveQuery(
	input: string,
	cursorPosition: number,
	options: ComposerDirectiveQueryOptions = {},
): ComposerDirectiveQuery | null {
	const beforeCursor = input.slice(0, cursorPosition);
	const match = beforeCursor.match(COMMAND_TRIGGER_PATTERN);
	if (!match?.[2]) {
		return null;
	}

	const token = match[2];
	const start = beforeCursor.length - token.length;
	const tokenSuffix = input.slice(cursorPosition).match(/^[^\s]*/)?.[0] ?? "";
	const directive = {
		trigger: token[0] as ComposerCommandTrigger,
		query: token.slice(1).toLowerCase(),
		start,
		end: cursorPosition + tokenSuffix.length,
	};

	if (
		options.ignoredRanges?.some(
			(range) => directive.start < range.end && directive.end > range.start,
		)
	) {
		return null;
	}

	return directive;
}

export function getComposerInlineTokenText(label: string) {
	return `@${label}`;
}

export function getComposerInlineTokenRange(
	position: number,
	label: string,
): ComposerDirectiveIgnoredRange {
	const start = Math.max(0, position);
	return {
		start,
		end: start + getComposerInlineTokenText(label).length,
	};
}

export function findComposerInlineTokenRanges(
	input: string,
	label: string,
): ComposerDirectiveIgnoredRange[] {
	const tokenText = getComposerInlineTokenText(label);
	if (!tokenText) {
		return [];
	}

	const ranges: ComposerDirectiveIgnoredRange[] = [];
	let searchFrom = 0;
	while (searchFrom < input.length) {
		const start = input.indexOf(tokenText, searchFrom);
		if (start === -1) {
			break;
		}
		ranges.push({
			start,
			end: start + tokenText.length,
		});
		searchFrom = start + tokenText.length;
	}

	return ranges;
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
	cursorOffsetOrOptions?: number | ComposerDirectiveReplacementOptions,
): ComposerDirectiveReplacement {
	const options =
		typeof cursorOffsetOrOptions === "number"
			? { cursorOffset: cursorOffsetOrOptions }
			: (cursorOffsetOrOptions ?? {});
	const before = input.slice(0, directive.start).replace(/\s+$/, "");
	const after = input.slice(directive.end).replace(/^\s+/, "");
	const value = replacement.trim();
	const replacementStart = before.length + (before && value ? 1 : 0);
	const replacementEnd = replacementStart + value.length;
	const insertedValue = options.appendTrailingSpace && value && !after ? `${value} ` : value;
	const replacementCursorPosition =
		replacementStart + (options.cursorOffset ?? insertedValue.length);

	if (!before && !value) {
		return { input: after, cursorPosition: 0, replacementStart: 0, replacementEnd: 0 };
	}
	if (!after && !value) {
		return {
			input: before,
			cursorPosition: before.length,
			replacementStart,
			replacementEnd,
		};
	}
	return {
		input: [before, insertedValue, after].filter(Boolean).join(" "),
		cursorPosition: replacementCursorPosition,
		replacementStart,
		replacementEnd,
	};
}

export function appendComposerInlineTokenWithCursor(
	input: string,
	label: string,
): ComposerDirectiveReplacement {
	const before = input.replace(/\s+$/, "");
	const tokenText = getComposerInlineTokenText(label);
	const replacementStart = before ? before.length + 1 : 0;
	const replacementEnd = replacementStart + tokenText.length;
	const nextInput = before ? `${before} ${tokenText} ` : `${tokenText} `;

	return {
		input: nextInput,
		cursorPosition: replacementEnd + 1,
		replacementStart,
		replacementEnd,
	};
}

export function matchesComposerCommand(query: string, values: Array<string | undefined>): boolean {
	const normalizedQuery = query.trim().toLowerCase();
	if (!normalizedQuery) {
		return true;
	}

	return values.some((value) => value?.toLowerCase().includes(normalizedQuery));
}
