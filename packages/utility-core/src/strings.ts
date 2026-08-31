export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function parseCommaSeparatedList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
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
