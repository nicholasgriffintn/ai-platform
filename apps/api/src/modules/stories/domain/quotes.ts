import { STORY_QUOTE_MAX_WORDS } from "@ngriffin_uk/polychat-schemas";

const MIN_QUOTE_WORDS = 3;

export interface QuoteCandidate {
  speaker: string;
  context: string;
  outlet: string;
  text: string;
}

export interface QuoteBody {
  articleId: string;
  outlet: string;
  body: string;
}

export interface VerifiedQuote extends QuoteCandidate {
  articleId: string;
}

function normaliseQuoteText(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[‘’‛′]/gu, "'")
    .replace(/[“”‟″]/gu, '"')
    .replace(/\s+/gu, " ")
    .trim();
}

function stripWrappingQuotes(value: string): string {
  return value.replace(/^["']+|["']+$/gu, "").trim();
}

function countWords(value: string): number {
  return value.split(/\s+/u).filter(Boolean).length;
}

export function verifyQuote(
  candidate: QuoteCandidate,
  bodies: readonly QuoteBody[],
): VerifiedQuote | null {
  const text = stripWrappingQuotes(normaliseQuoteText(candidate.text));
  const words = countWords(text);

  if (words < MIN_QUOTE_WORDS || words > STORY_QUOTE_MAX_WORDS || !candidate.speaker.trim()) {
    return null;
  }

  const ordered = [
    ...bodies.filter((body) => body.outlet === candidate.outlet),
    ...bodies.filter((body) => body.outlet !== candidate.outlet),
  ];
  const source = ordered.find((body) => normaliseQuoteText(body.body).includes(text));

  return source ? { ...candidate, text, articleId: source.articleId, outlet: source.outlet } : null;
}
