function downgradeH1Headings(markdown: string): string {
  return markdown.replace(/^# (.*)$/gm, "## $1");
}

function completeMarkdownTags(markdown: string): string {
  let content = markdown;

  if ((content.match(/```/g) ?? []).length % 2 === 1) {
    content += "\n```";
  }

  const inlineCodeCount = (content.match(/(?<!\\)`/g) ?? []).length;

  if (inlineCodeCount % 2 === 1) {
    const contentAfterTick = content.slice(content.lastIndexOf("`") + 1);

    if (contentAfterTick.trim().length > 0) {
      content += "`";
    }
  }

  const boldMarkers = content.match(/\*\*/g) ?? [];

  if (boldMarkers.length % 2 === 1) {
    const contentAfterBold = content.slice(content.lastIndexOf("**") + 2);

    if (contentAfterBold.trim().length > 0) {
      content += "**";
    }
  }

  const contentWithoutBold = content.replace(/\*\*/g, "");

  if ((contentWithoutBold.match(/\*/g) ?? []).length % 2 === 1) {
    const lastItalicIndex = content.lastIndexOf("*");

    if (content[lastItalicIndex - 1] !== "*" && content[lastItalicIndex + 1] !== "*") {
      const contentAfterItalic = content.slice(lastItalicIndex + 1);

      if (contentAfterItalic.trim().length > 0) {
        content += "*";
      }
    }
  }

  const openBrackets = (content.match(/\[/g) ?? []).length;
  const closeBrackets = (content.match(/\]/g) ?? []).length;

  if (openBrackets > closeBrackets && /\[[^\]]+$/.test(content)) {
    content += "](...)";
  }

  const lastLine = content.split("\n").at(-1);

  if (lastLine?.includes("|") && lastLine.split("|").length > 2 && !lastLine.trim().endsWith("|")) {
    content += " |";
  }

  return content;
}

function safeParseMarkdown(markdown: string): string {
  return completeMarkdownTags(markdown).replace(/<[^>]*$/, "");
}

function isLikelyIncomplete(markdown: string): boolean {
  if (!markdown) {
    return false;
  }

  const trimmed = markdown.trim();

  const boldMarkers = (trimmed.match(/\*\*/g) ?? []).length;
  const boldNeedsCompletion =
    boldMarkers % 2 === 1 && trimmed.slice(trimmed.lastIndexOf("**") + 2).trim().length > 0;

  const inlineCode = (trimmed.match(/(?<!\\)`/g) ?? []).length;
  const codeNeedsCompletion =
    inlineCode % 2 === 1 && trimmed.slice(trimmed.lastIndexOf("`") + 1).trim().length > 0;

  const contentWithoutBold = trimmed.replace(/\*\*/g, "");
  const italicMarkers = (contentWithoutBold.match(/\*/g) ?? []).length;
  const lastItalicIndex = trimmed.lastIndexOf("*");
  const italicNeedsCompletion =
    italicMarkers % 2 === 1 &&
    trimmed[lastItalicIndex - 1] !== "*" &&
    trimmed[lastItalicIndex + 1] !== "*" &&
    trimmed.slice(lastItalicIndex + 1).trim().length > 0;

  const codeBlocks = (trimmed.match(/```/g) ?? []).length;
  const openBrackets = (trimmed.match(/\[/g) ?? []).length;
  const closeBrackets = (trimmed.match(/\]/g) ?? []).length;

  return (
    codeBlocks % 2 === 1 ||
    codeNeedsCompletion ||
    boldNeedsCompletion ||
    italicNeedsCompletion ||
    (openBrackets > closeBrackets && /\[[^\]]+$/.test(trimmed)) ||
    /<[a-zA-Z][^>]*$/.test(trimmed)
  );
}

export function fixMarkdown(markdown: string, isStreaming?: boolean): string {
  const content = downgradeH1Headings(markdown);

  return isStreaming || isLikelyIncomplete(content) ? safeParseMarkdown(content) : content;
}
