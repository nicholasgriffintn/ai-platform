/**
 * Markdown utilities for improving rendering of incomplete markdown
 * This simplified approach focuses on handling common edge cases in streaming markdown content
 */

/**
 * Process custom XML tags in markdown content, converting them to markdown format
 * Example: <custom_tag>content</custom_tag> becomes **Custom Tag**\n\ncontent\n\n
 */
export function processCustomXmlTags(text: string): string {
  const codeFenceRegex = /```[\s\S]*?```/g;
  const fences: string[] = [];
  const placeholderPrefix = "<<CODE_BLOCK_";
  let idx = 0;

  const textNoFences = text.replace(codeFenceRegex, (match) => {
    const placeholder = `${placeholderPrefix}${idx}>>`;
    fences[idx++] = match;
    return placeholder;
  });

  const xmlTagRegex = /<([A-Za-z][\w-]*)\b[^>]*>([\s\S]*?)<\/\1>/g;
  const processed = textNoFences.replace(
    xmlTagRegex,
    (_match, tagName, inner) => {
      const title = tagName
        .split(/[_-]/)
        .map(
          (w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
        )
        .join(" ");
      return `**${title}**\n\n${inner}\n\n`;
    },
  );

  let result = processed;
  fences.forEach((fence, i) => {
    const placeholder = `${placeholderPrefix}${i}>>`;
    result = result.replace(placeholder, fence);
  });

  return result;
}

/**
 * Determines if a collection of artifacts can be combined (displayed together)
 * Currently checks if there are both JSX/JavaScript and CSS artifacts
 */
export function canCombineArtifacts(
  artifacts: Array<{ language?: string }>,
): boolean {
  if (artifacts.length < 2) return false;

  const hasJsx = artifacts.some(
    (a) =>
      a.language?.toLowerCase().includes("jsx") ||
      a.language?.toLowerCase().includes("javascript"),
  );

  const hasCss = artifacts.some((a) =>
    a.language?.toLowerCase().includes("css"),
  );

  return hasJsx && hasCss;
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

/**
 * Clean incomplete markdown by handling common syntax issues
 * @param markdown The input markdown string to clean
 * @returns Cleaned markdown with partial syntax fixed
 */
export function cleanIncompleteMarkdown(markdown: string): string {
  if (!markdown) return "";

  let result = markdown;

  result = fixIncompleteCodeBlocks(result);
  result = fixIncompleteEmphasis(result);
  result = fixIncompleteLinks(result);
  result = fixIncompleteLists(result);
  result = fixIncompleteHorizontalRules(result);

  return result;
}

/**
 * Fix incomplete code blocks in markdown
 */
function fixIncompleteCodeBlocks(markdown: string): string {
  const lines = markdown.split("\n");
  let inCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trim().startsWith("```")) {
      if (!inCodeBlock) {
        inCodeBlock = true;
      } else {
        inCodeBlock = false;
      }
    }
  }

  if (inCodeBlock) {
    lines.push("```");
  }

  return lines.join("\n");
}

/**
 * Fix incomplete emphasis markers (bold, italic)
 */
function fixIncompleteEmphasis(markdown: string): string {
  const lines = markdown.split("\n");

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    const asteriskCount = countChar(line, "*");
    const underscoreCount = countChar(line, "_");
    const tildeCount = countChar(line, "~");

    if (asteriskCount % 2 !== 0) {
      const match = /\*+[^*]*$/.exec(line);
      if (match) {
        line = line.substring(0, match.index);
      }
    }

    if (underscoreCount % 2 !== 0) {
      const match = /_+[^_]*$/.exec(line);
      if (match) {
        line = line.substring(0, match.index);
      }
    }

    if (tildeCount % 2 !== 0) {
      const match = /~+[^~]*$/.exec(line);
      if (match) {
        line = line.substring(0, match.index);
      }
    }

    lines[i] = line;
  }

  return lines.join("\n");
}

/**
 * Count occurrences of a character in a string
 */
function countChar(str: string, char: string): number {
  let count = 0;
  for (let i = 0; i < str.length; i++) {
    if (str[i] === char) count++;
  }
  return count;
}

/**
 * Fix incomplete links in markdown
 */
function fixIncompleteLinks(markdown: string): string {
  const lines = markdown.split("\n");

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    const openBrackets = countChar(line, "[");
    const closeBrackets = countChar(line, "]");

    if (openBrackets > closeBrackets) {
      const lastOpenBracket = line.lastIndexOf("[");
      let matchFound = false;

      for (let j = lastOpenBracket + 1; j < line.length; j++) {
        if (line[j] === "]") {
          matchFound = true;
          break;
        }
      }

      if (!matchFound) {
        line = line.substring(0, lastOpenBracket);
      }
    }

    const linkTextMatch = line.match(/\[[^\]]+\]\([^)]*$/);
    if (linkTextMatch) {
      const openingParen = line.lastIndexOf("(");
      if (openingParen !== -1) {
        line = line.substring(0, openingParen);
      }
    }

    lines[i] = line;
  }

  return lines.join("\n");
}

/**
 * Fix incomplete lists in markdown
 */
function fixIncompleteLists(markdown: string): string {
  const lines = markdown.split("\n");

  if (lines.length > 0) {
    const lastLine = lines[lines.length - 1].trim();
    if (/^[*+-]\s*$/.test(lastLine) || /^\d+\.\s*$/.test(lastLine)) {
      lines.pop();
    }
  }

  return lines.join("\n");
}

/**
 * Fix incomplete horizontal rules in markdown
 */
function fixIncompleteHorizontalRules(markdown: string): string {
  const lines = markdown.split("\n");

  if (lines.length > 0) {
    const lastLine = lines[lines.length - 1].trim();
    if (/^[-*_]{1,2}\s*$/.test(lastLine)) {
      lines.pop();
    }
  }

  return lines.join("\n");
}
