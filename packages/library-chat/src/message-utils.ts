/**
 * Process custom XML tags in markdown content, converting them to markdown format
 * Example: <custom_tag>content</custom_tag> becomes **Custom Tag**\n\ncontent\n\n
 */
export function processCustomXmlTags(text: string): string {
  const protectedRegionRegex = /(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`|^(?: {4}|\t).*$)/gm;
  const protectedRegions: string[] = [];
  const placeholderPrefix = "\u0000polychat-protected-";
  const placeholderSuffix = "\u0000";

  const masked = text.replace(protectedRegionRegex, (match) => {
    const placeholder = `${placeholderPrefix}${protectedRegions.length}${placeholderSuffix}`;

    protectedRegions.push(match);

    return placeholder;
  });

  const xmlTagRegex = /<([A-Za-z][\w-]*)\b[^>]*>([\s\S]*?)<\/\1>/g;
  const processed = masked.replace(xmlTagRegex, (_match, tagName, inner) => {
    const title = tagName
      .split(/[_-]/)
      .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");

    return `**${title}**\n\n${inner}\n\n`;
  });

  return processed.replace(
    new RegExp(`${placeholderPrefix}(\\d+)${placeholderSuffix}`, "g"),
    (match, index: string) => protectedRegions[Number(index)] ?? match,
  );
}

/**
 * Splits content by artifact markers and returns the parts
 */
export function splitContentByArtifacts(content: string): {
  textParts: string[];
  identifiers: string[];
} {
  const parts = content.split(/\[\[ARTIFACT:([^\]]+)\]\]/);
  const textParts: string[] = [];
  const identifiers: string[] = [];

  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) {
      textParts.push(parts[i]);
    } else {
      identifiers.push(parts[i]);
    }
  }

  return { textParts, identifiers };
}
