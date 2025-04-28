/**
 * Text processing utilities for editor and content display
 */

/**
 * Calculate the word count from a text string
 */
export function getWordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

/**
 * Calculate the character count from a text string
 */
export function getCharCount(text: string): number {
  return text.length;
}

/**
 * Apply proper spacing between new text and existing text
 */
export function formatTextWithSpacing(
  existingText: string,
  newText: string,
): string {
  if (existingText && !existingText.endsWith(" ") && !newText.startsWith(" ")) {
    return `${existingText} ${newText}`;
  }

  return existingText + newText;
}

/**
 * Extract title and content from note text
 */
export function splitTitleAndContent(text: string): [string, string] {
  const [firstLine, ...rest] = text.split("\n");
  return [firstLine, rest.join("\n")];
}
