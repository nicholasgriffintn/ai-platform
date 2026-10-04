const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

export function htmlToPlainText(html: string): string {
  return html
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<(?:br|hr)\b[^>]*>|<\/(?:p|div|h[1-6]|li|tr|pre|blockquote)>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, name: string) => {
      if (!name.startsWith("#")) {
        return ENTITIES[name.toLowerCase()] ?? entity;
      }

      const code = name.toLowerCase().startsWith("#x")
        ? Number.parseInt(name.slice(2), 16)
        : Number.parseInt(name.slice(1), 10);

      return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff)
        ? String.fromCodePoint(code)
        : entity;
    })
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
