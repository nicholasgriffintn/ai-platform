export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const naturalTextCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

export function compareNaturalText(left: string, right: string): number {
  return naturalTextCollator.compare(left, right);
}

export function parseCommaSeparatedList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function splitNonEmptyLines(value: string): string[] {
  return value
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
}

export const parseCommaSeparatedTags = parseCommaSeparatedList;

export function getWordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

export function getCharCount(text: string): number {
  return text.length;
}

export function formatTextWithSpacing(existingText: string, newText: string): string {
  if (existingText && !existingText.endsWith(" ") && !newText.startsWith(" ")) {
    return `${existingText} ${newText}`;
  }

  return existingText + newText;
}

export function splitTitleAndContent(text: string): [string, string] {
  const [firstLine = "", ...rest] = text.split("\n");

  return [firstLine, rest.join("\n")];
}

export function capitaliseFirst(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

export function titleCaseSlug(value: string): string {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map(capitaliseFirst)
    .join(" ");
}

export function joinNonEmptyStrings(
  parts: Array<string | null | undefined>,
  separator = " ",
): string {
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(separator);
}

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

export function slugify(value: string, maxLength?: number): string {
  const collapsed = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-");
  const bounded = maxLength === undefined ? collapsed : collapsed.slice(0, maxLength);

  return bounded.replace(/^-|-$/gu, "");
}

export function trimTrailingCharacter(value: string, character: string): string {
  let end = value.length;

  while (end > 0 && value[end - 1] === character) {
    end -= 1;
  }

  return end === value.length ? value : value.slice(0, end);
}
