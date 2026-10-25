import { truncateSingleLine } from "./strings.js";

const BOILERPLATE =
  /\b(skip to (main )?content|content starts here|popular searches|sign in|sign up|log in|log on|subscribe|newsletter|cookie|privacy policy|terms of (use|service)|all rights reserved|advertisement|share this|follow us|read more|menu|navigation|accept all|manage preferences)\b/iu;
const BYLINE =
  /\b(is an? (\w+ ){0,2}(writer|contributor|editor|journalist|reporter|critic|author|producer) (for|at|with)|has been (writing|a (writer|journalist|contributor))|(he|she|they) (grew up|attended|graduated|lives?|loves?|enjoys?)|graduated from|can be reached at|follow (him|her|them) on|a contributor at|(he|she|they) (has|have) (self-)?published|(his|her|their) (instagram|twitter|blog|podcast)|lifelong fan|storyteller|fanatic who|writes and talks about)\b/iu;
const MIN_PARAGRAPH_CHARACTERS = 80;
const MIN_PARAGRAPH_WORDS = 12;

export function markdownToPlainText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/gu, " ")
    .replace(/<[^>]+>/gu, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/gu, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/gu, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gmu, "")
    .replace(/^\s*(?:[-*+]|\d+[.)])\s+/gmu, "")
    .replace(/^\s*>\s?/gmu, "")
    .replace(/[*`~]/gu, "")
    .replace(/(^|[\s(])_+|_+(?=[\s.,;:!?)]|$)/gu, "$1")
    .replace(/[ \t]+/gu, " ")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
}

function isProse(paragraph: string): boolean {
  const words = paragraph.split(/\s+/u).filter(Boolean);

  return (
    paragraph.length >= MIN_PARAGRAPH_CHARACTERS &&
    words.length >= MIN_PARAGRAPH_WORDS &&
    !BOILERPLATE.test(paragraph) &&
    !BYLINE.test(paragraph) &&
    (paragraph.match(/[.!?](\s|$)/gu)?.length ?? 0) >= 1 &&
    (paragraph.match(/\s[·|•]\s/gu)?.length ?? 0) <= 2
  );
}

export function isBoilerplate(text: string): boolean {
  return BOILERPLATE.test(text) || BYLINE.test(text);
}

export function leadParagraphs(text: string, maxCharacters: number): string {
  const paragraphs = text
    .split(/\n+/u)
    .map((paragraph) => paragraph.replace(/\s+/gu, " ").trim())
    .filter(Boolean);
  const start = paragraphs.findIndex(isProse);

  if (start === -1) {
    return "";
  }

  const kept: string[] = [];
  let length = 0;

  for (const paragraph of paragraphs.slice(start)) {
    if (!isProse(paragraph)) {
      continue;
    }

    kept.push(paragraph);
    length += paragraph.length + 1;

    if (length >= maxCharacters) {
      break;
    }
  }

  return truncateSingleLine(kept.join(" "), maxCharacters);
}
