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

const MODEL_CONTROL_TOKEN = /<\|[a-z_]+\|>/g;
const MODEL_FINAL_CHANNEL = /<\|start\|>assistant(?:<\|channel\|>)?final(?:<\|message\|>)?/;

const LEAKED_MODEL_PLAN = /^\s*analysis\b[\s\S]*\bassistant\s*(?:to=|commentary)/;
const LEAKED_MODEL_ANSWER = /^\s*analysis\b[\s\S]*\bassistantfinal/;

function removeControlTokens(text: string): string {
  if (!text.includes("<|")) {
    return text;
  }

  const finalChannel = MODEL_FINAL_CHANNEL.exec(text);
  const answer = finalChannel ? text.slice(finalChannel.index + finalChannel[0].length) : text;

  return answer.replace(MODEL_CONTROL_TOKEN, "").trim();
}

export function stripModelControlTokens(text: string): string {
  const cleaned = removeControlTokens(text);
  const leakedAnswer = LEAKED_MODEL_ANSWER.exec(cleaned);

  if (leakedAnswer) {
    return cleaned.slice(leakedAnswer[0].length).trim();
  }

  return LEAKED_MODEL_PLAN.test(cleaned) ? "" : cleaned;
}

export function fixMarkdown(markdown: string, isStreaming?: boolean): string {
  const content = downgradeH1Headings(stripModelControlTokens(markdown));

  return isStreaming || isLikelyIncomplete(content) ? safeParseMarkdown(content) : content;
}

export interface MarkdownBlock {
  kind: "heading" | "item" | "paragraph";
  text: string;
  start: number;
  end: number;
}

const MARKDOWN_HEADING = /^#{1,6}\s+/;
const MARKDOWN_LIST_ITEM = /^(?:[-*+]|\d+[.)])\s+/;

export function splitMarkdownBlocks(markdown: string): MarkdownBlock[] {
  const lines = markdown.split("\n");
  const blocks: MarkdownBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (line.trim() === "") {
      index += 1;
      continue;
    }

    if (MARKDOWN_HEADING.test(line)) {
      blocks.push({
        kind: "heading",
        text: line.replace(MARKDOWN_HEADING, "").trim(),
        start: index,
        end: index + 1,
      });
      index += 1;
      continue;
    }

    const isItem = MARKDOWN_LIST_ITEM.test(line);
    const start = index;

    index += 1;

    while (index < lines.length) {
      const next = lines[index];

      if (next.trim() === "" || MARKDOWN_HEADING.test(next)) {
        break;
      }

      if (MARKDOWN_LIST_ITEM.test(next)) {
        break;
      }

      index += 1;
    }

    blocks.push({
      kind: isItem ? "item" : "paragraph",
      text: lines
        .slice(start, index)
        .map((entry) => entry.trim())
        .join(" ")
        .replace(MARKDOWN_LIST_ITEM, ""),
      start,
      end: index,
    });
  }

  return blocks;
}

export interface MarkdownSegment {
  start: number;
  text: string;
}

const MARKDOWN_FENCE = /^ {0,3}(`{3,}(?=[^`]*$)|~{3,})/;

function closesMarkdownFence(line: string, marker: string | undefined, fence: string): boolean {
  return (
    marker !== undefined &&
    marker[0] === fence[0] &&
    marker.length >= fence.length &&
    line.trim() === marker
  );
}

function startsTopLevelSegment(line: string | undefined): boolean {
  return (
    line !== undefined && line.trim() !== "" && !/^\s/.test(line) && !MARKDOWN_LIST_ITEM.test(line)
  );
}

export function splitMarkdownSegments(markdown: string): MarkdownSegment[] {
  const lines = markdown.split("\n");
  const segments: MarkdownSegment[] = [];
  let start = 0;
  let fence: string | null = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const marker = MARKDOWN_FENCE.exec(line)?.[1];

    if (fence) {
      fence = closesMarkdownFence(line, marker, fence) ? null : fence;
    } else if (marker) {
      fence = marker;
    } else if (line.trim() === "" && startsTopLevelSegment(lines[index + 1])) {
      segments.push({ start, text: lines.slice(start, index).join("\n") });
      start = index + 1;
    }
  }

  segments.push({ start, text: lines.slice(start).join("\n") });

  return segments;
}

export function removeMarkdownBlock(markdown: string, block: Pick<MarkdownBlock, "start" | "end">) {
  const lines = markdown.split("\n");

  lines.splice(block.start, block.end - block.start);

  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function markdownBullets(values: readonly string[]): string[] {
  return values.map((value) => `- ${value}`);
}

export function markdownSection(title: string, lines: readonly string[], empty: string): string {
  return [`## ${title}`, ...(lines.length > 0 ? lines : [empty])].join("\n");
}
