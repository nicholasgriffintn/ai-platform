import { normaliseComparableText } from "@ngriffin_uk/polychat-utility-core";

export const STORY_ATTACH_SIMILARITY = 0.8;
export const STORY_WINDOW_HOURS = 72;
export const STORY_MATCH_LIMIT = 12;
const MIN_SHARED_PHRASES = 2;
const MIN_PHRASE_LENGTH = 4;
const NAME_PATTERN =
  /\p{Lu}[\p{L}\p{N}'’.-]*(?:\s+(?:of|de|la|van|von|al|the)?\s*\p{Lu}[\p{L}\p{N}'’.-]*)*/gu;
const PHRASE_STOP_WORDS = new Set([
  "about",
  "after",
  "again",
  "against",
  "amid",
  "before",
  "being",
  "between",
  "could",
  "first",
  "from",
  "have",
  "into",
  "just",
  "more",
  "most",
  "news",
  "over",
  "part",
  "says",
  "said",
  "some",
  "than",
  "that",
  "their",
  "them",
  "there",
  "these",
  "they",
  "this",
  "those",
  "under",
  "until",
  "what",
  "when",
  "where",
  "which",
  "while",
  "will",
  "with",
  "would",
  "year",
  "years",
  "your",
]);

export interface ArticleSignals {
  names: ReadonlySet<string>;
  phrases: ReadonlySet<string>;
}

export interface StoryMatch {
  storyId: string;
  score: number;
  signals: ArticleSignals;
}

export type StoryDecision = { kind: "attach"; storyId: string; score: number } | { kind: "open" };

function collectNames(text: string): Set<string> {
  const names = new Set<string>();

  for (const sentence of text.split(/[.!?:;|–—]\s+/u)) {
    for (const match of sentence.trim().matchAll(NAME_PATTERN)) {
      const name = normaliseComparableText(match[0]);
      const isOpeningWord = match.index === 0 && !/\s/u.test(match[0]);

      if (name.length >= 3 && !isOpeningWord && !PHRASE_STOP_WORDS.has(name)) {
        names.add(name);
      }
    }
  }

  return names;
}

function collectPhrases(text: string): Set<string> {
  return new Set(
    normaliseComparableText(text)
      .split(/\s+/u)
      .filter((word) => word.length >= MIN_PHRASE_LENGTH && !PHRASE_STOP_WORDS.has(word))
      .map((word) => word.replace(/(?:ing|ed|es|s)$/u, "")),
  );
}

export function readArticleSignals(headline: string, standfirst: string): ArticleSignals {
  const text = `${headline}. ${standfirst}`;

  return { names: collectNames(text), phrases: collectPhrases(text) };
}

function countShared(left: ReadonlySet<string>, right: ReadonlySet<string>): number {
  let shared = 0;

  for (const value of left) {
    if (right.has(value)) {
      shared += 1;
    }
  }

  return shared;
}

export function signalsOverlap(left: ArticleSignals, right: ArticleSignals): boolean {
  return (
    countShared(left.names, right.names) >= 1 ||
    countShared(left.phrases, right.phrases) >= MIN_SHARED_PHRASES
  );
}

export function decideStory(
  article: ArticleSignals,
  matches: readonly StoryMatch[],
): StoryDecision {
  const best = [...matches]
    .filter(
      (match) => match.score >= STORY_ATTACH_SIMILARITY && signalsOverlap(article, match.signals),
    )
    .sort((left, right) => right.score - left.score)[0];

  return best ? { kind: "attach", storyId: best.storyId, score: best.score } : { kind: "open" };
}

export function storyWindow(publishedAt: string): { since: string; until: string } {
  const at = Date.parse(publishedAt);
  const span = STORY_WINDOW_HOURS * 60 * 60 * 1000;

  return {
    since: new Date(at - span).toISOString(),
    until: new Date(at + span).toISOString(),
  };
}
