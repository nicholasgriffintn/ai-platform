export function trimTemplateWhitespace(str: string): string {
  // Replace multiple spaces with a single space
  // Remove spaces at the start of each line (common in template literals)
  // Remove multiple consecutive empty lines
  return str
    .replace(/[ \t]+/g, " ")
    .replace(/^[ \t]+/gm, "")
    .replace(/\n{3,}/g, "\n\n");
}
