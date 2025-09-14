function downgradeH1Headings(markdown: string): string {
  return markdown.replace(/^# (.*)$/gm, "## $1");
}

function completeMarkdownTags(markdown: string): string {
  let content = markdown;

  // Complete incomplete code blocks
  const codeBlocks = content.match(/```/g) || [];
  if (codeBlocks.length % 2 === 1) {
    content += "\n```";
  }

  // Complete incomplete inline code - only if there's content after the last `
  const inlineCodeCount = (content.match(/(?<!\\)`/g) || []).length;
  if (inlineCodeCount % 2 === 1) {
    const lastTickIndex = content.lastIndexOf("`");
    const contentAfterTick = content.slice(lastTickIndex + 1);
    if (contentAfterTick?.trim().length > 0) {
      content += "`";
    }
  }

  // Complete incomplete bold - only if there's content after the last **
  const boldMarkers = content.match(/\*\*/g) || [];
  if (boldMarkers.length % 2 === 1) {
    const lastBoldIndex = content.lastIndexOf("**");
    const contentAfterBold = content.slice(lastBoldIndex + 2);
    if (contentAfterBold?.trim().length > 0) {
      content += "**";
    }
  }

  // Complete incomplete italic - only if there's content after the last *
  const contentWithoutBold = content.replace(/\*\*/g, "");
  const italicMarkers = contentWithoutBold.match(/\*/g) || [];
  if (italicMarkers.length % 2 === 1) {
    const lastItalicIndex = content.lastIndexOf("*");
    if (
      content[lastItalicIndex - 1] !== "*" &&
      content[lastItalicIndex + 1] !== "*"
    ) {
      const contentAfterItalic = content.slice(lastItalicIndex + 1);
      if (contentAfterItalic?.trim().length > 0) {
        content += "*";
      }
    }
  }

  // Complete incomplete links - only if we have [ without matching ]
  const openBrackets = (content.match(/\[/g) || []).length;
  const closeBrackets = (content.match(/\]/g) || []).length;
  if (openBrackets > closeBrackets && /\[[^\]]+$/.test(content)) {
    content += "](...)";
  }

  // Complete incomplete tables (only if it's clearly a table row)
  const lines = content.split("\n");
  const lastLine = lines[lines.length - 1];
  if (
    lastLine?.includes("|") &&
    lastLine?.split("|").length > 2 &&
    !lastLine?.trim().endsWith("|")
  ) {
    content += " |";
  }

  return content;
}

function safeParseMarkdown(markdown: string): string {
  try {
    const completed = completeMarkdownTags(markdown);

    return completed.replace(/<[^>]*$/, "");
  } catch (error) {
    console.warn("Markdown completion failed:", error);
    return markdown;
  }
}

function isLikelyIncomplete(markdown: string): boolean {
  if (!markdown) return false;
  const trimmed = markdown.trim();

  const boldMarkers = (trimmed.match(/\*\*/g) || []).length;
  const boldNeedsCompletion =
    boldMarkers % 2 === 1 &&
    (() => {
      const lastBoldIndex = trimmed.lastIndexOf("**");
      const contentAfterBold = trimmed.slice(lastBoldIndex + 2);
      return contentAfterBold?.trim().length > 0;
    })();

  const inlineCode = (trimmed.match(/(?<!\\)`/g) || []).length;
  const codeNeedsCompletion =
    inlineCode % 2 === 1 &&
    (() => {
      const lastTickIndex = trimmed.lastIndexOf("`");
      const contentAfterTick = trimmed.slice(lastTickIndex + 1);
      return contentAfterTick?.trim().length > 0;
    })();

  const contentWithoutBold = trimmed.replace(/\*\*/g, "");
  const italicMarkers = (contentWithoutBold.match(/\*/g) || []).length;
  const italicNeedsCompletion =
    italicMarkers % 2 === 1 &&
    (() => {
      const lastItalicIndex = trimmed.lastIndexOf("*");
      if (
        trimmed[lastItalicIndex - 1] === "*" ||
        trimmed[lastItalicIndex + 1] === "*"
      ) {
        return false;
      }
      const contentAfterItalic = trimmed.slice(lastItalicIndex + 1);
      return contentAfterItalic?.trim().length > 0;
    })();
  const codeBlocks = (trimmed.match(/```/g) || []).length;
  const openBrackets = (trimmed.match(/\[/g) || []).length;
  const closeBrackets = (trimmed.match(/\]/g) || []).length;

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
  let content = downgradeH1Headings(markdown);

  if (isStreaming || isLikelyIncomplete(content)) {
    content = safeParseMarkdown(content);
  }

  return content;
}
