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

const ARTIFACT_MARKER_START = "[[ARTIFACT:";
const ARTIFACT_MARKER_END = "]]";

export function splitContentByArtifacts(content: string): {
  textParts: string[];
  identifiers: string[];
} {
  const textParts: string[] = [];
  const identifiers: string[] = [];
  let textStart = 0;
  let searchFrom = 0;

  while (searchFrom < content.length) {
    const markerStart = content.indexOf(ARTIFACT_MARKER_START, searchFrom);

    if (markerStart === -1) {
      break;
    }

    const identifierStart = markerStart + ARTIFACT_MARKER_START.length;
    const identifierEnd = content.indexOf("]", identifierStart);

    if (identifierEnd === -1) {
      break;
    }

    if (
      identifierEnd === identifierStart ||
      content.startsWith(ARTIFACT_MARKER_END, identifierEnd) === false
    ) {
      searchFrom = markerStart + 1;
      continue;
    }

    textParts.push(content.slice(textStart, markerStart));
    identifiers.push(content.slice(identifierStart, identifierEnd));
    textStart = identifierEnd + ARTIFACT_MARKER_END.length;
    searchFrom = textStart;
  }

  textParts.push(content.slice(textStart));

  return { textParts, identifiers };
}
