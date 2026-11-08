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

const MENTION_TRIGGER_PATTERN = /(^|\s)(@[^\s]*)$/;
const SLASH_TRIGGER_PATTERN = /(^|\s)(\/(?!\s)[^\n]*)$/;

export function getComposerDirectiveQuery(
  input: string,
  cursorPosition: number,
  options: ComposerDirectiveQueryOptions = {},
): ComposerDirectiveQuery | null {
  const beforeCursor = input.slice(0, cursorPosition);
  const match =
    beforeCursor.match(SLASH_TRIGGER_PATTERN) ?? beforeCursor.match(MENTION_TRIGGER_PATTERN);

  if (!match?.[2]) {
    return null;
  }

  const token = match[2];
  const start = beforeCursor.length - token.length;
  const tokenSuffix = /\s$/.test(token)
    ? ""
    : (input.slice(cursorPosition).match(/^[^\s]*/)?.[0] ?? "");
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
  tokenText = getComposerInlineTokenText(label),
): ComposerDirectiveIgnoredRange {
  const start = Math.max(0, position);

  return {
    start,
    end: start + tokenText.length,
  };
}

export function findComposerInlineTokenRanges(
  input: string,
  label: string,
  tokenText = getComposerInlineTokenText(label),
): ComposerDirectiveIgnoredRange[] {
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
  const before = input.slice(0, directive.start).trimEnd();
  const after = input.slice(directive.end).trimStart();
  const value = replacement.trim();
  const replacementStart = before.length + (before && value ? 1 : 0);
  const replacementEnd = replacementStart + value.length;
  const insertedValue = options.appendTrailingSpace && value && !after ? `${value} ` : value;
  const replacementCursorPosition =
    replacementStart +
    (options.cursorOffset ?? value.length + (options.appendTrailingSpace && value ? 1 : 0));

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
  tokenText = getComposerInlineTokenText(label),
): ComposerDirectiveReplacement {
  const before = input.trimEnd();
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

export interface ComposerSlashCommandCandidate {
  command: string;
  label?: string;
  description?: string;
}

const SlashCommandMatchTier = {
  Exact: 0,
  Prefix: 1,
  WordBoundary: 2,
  Substring: 3,
  Description: 4,
} as const;

type SlashCommandMatchTier = (typeof SlashCommandMatchTier)[keyof typeof SlashCommandMatchTier];

function startsAtWordBoundary(value: string, query: string): boolean {
  let index = value.indexOf(query);

  while (index !== -1) {
    if (index === 0 || !/[a-z0-9]/u.test(value[index - 1] ?? "")) {
      return true;
    }

    index = value.indexOf(query, index + 1);
  }

  return false;
}

function getNameMatchTier(name: string, query: string): SlashCommandMatchTier | null {
  if (name === query) {
    return SlashCommandMatchTier.Exact;
  }

  if (name.startsWith(query)) {
    return SlashCommandMatchTier.Prefix;
  }

  if (startsAtWordBoundary(name, query)) {
    return SlashCommandMatchTier.WordBoundary;
  }

  return name.includes(query) ? SlashCommandMatchTier.Substring : null;
}

function getSlashCommandMatchTier(
  query: string,
  candidate: ComposerSlashCommandCandidate,
): SlashCommandMatchTier | null {
  const nameTier = [candidate.command, candidate.label].reduce<SlashCommandMatchTier | null>(
    (best, name) => {
      const tier = name ? getNameMatchTier(name.trim().toLowerCase(), query) : null;

      return tier !== null && (best === null || tier < best) ? tier : best;
    },
    null,
  );

  if (nameTier !== null) {
    return nameTier;
  }

  return candidate.description?.toLowerCase().includes(query)
    ? SlashCommandMatchTier.Description
    : null;
}

export function rankComposerSlashCommands<T extends ComposerSlashCommandCandidate>(
  query: string,
  commands: readonly T[],
): T[] {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return [...commands];
  }

  return commands
    .map((command, index) => ({
      command,
      index,
      tier: getSlashCommandMatchTier(normalizedQuery, command),
    }))
    .filter(
      (entry): entry is { command: T; index: number; tier: SlashCommandMatchTier } =>
        entry.tier !== null,
    )
    .sort((left, right) => left.tier - right.tier || left.index - right.index)
    .map((entry) => entry.command);
}
