import { normaliseComparableText } from "@ngriffin_uk/polychat-utility-core";

export const STORY_ATTACH_SIMILARITY = 0.8;
export const STORY_SIGNAL_SIMILARITY = 0.62;
export const STORY_PHRASE_SIMILARITY = 0.7;
export const STORY_WINDOW_HOURS = 72;
export const STORY_WIDE_WINDOW_HOURS = 7 * 24;
export const STORY_MATCH_LIMIT = 12;
const WIDE_WINDOW_MIN_ARTICLES = 3;
const MIN_SHARED_PHRASES = 2;
const UMBRELLA_SHARE = 0.025;
const UMBRELLA_MIN_COUNT = 6;
const UMBRELLA_MIN_FACTS = 20;
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

export interface UmbrellaTerms {
  names: ReadonlySet<string>;
  phrases: ReadonlySet<string>;
}

export const NO_UMBRELLA_TERMS: UmbrellaTerms = { names: new Set(), phrases: new Set() };

export interface StoryMatch {
  storyId: string;
  score: number;
  signals: ArticleSignals;
  publishedAt: string;
}

export type StoryDecision = { kind: "attach"; storyId: string; score: number } | { kind: "open" };

function collectNames(text: string): Set<string> {
  const names = new Set<string>();

  for (const sentence of text.split(/[.!?:;|–—]\s+/u)) {
    for (const match of sentence.trim().matchAll(NAME_PATTERN)) {
      const name = normaliseComparableText(match[0].replace(/['’]s$/u, ""));
      const isOpeningWord = match.index === 0 && !/\s/u.test(match[0]);

      if (name.length >= 3 && !isOpeningWord && !PHRASE_STOP_WORDS.has(name)) {
        names.add(name);
      }
    }
  }

  return names;
}

function phraseStem(word: string): string {
  return word.replace(/(?:ing|ed|es|s)$/u, "");
}

function collectPhrases(text: string): Set<string> {
  return new Set(
    normaliseComparableText(text)
      .split(/\s+/u)
      .filter((word) => word.length >= MIN_PHRASE_LENGTH && !PHRASE_STOP_WORDS.has(word))
      .map(phraseStem),
  );
}

export function readArticleSignals(headline: string, standfirst: string): ArticleSignals {
  const text = `${headline}. ${standfirst}`;

  return { names: collectNames(text), phrases: collectPhrases(text) };
}

function countShared(
  left: ReadonlySet<string>,
  right: ReadonlySet<string>,
  excluded: ReadonlySet<string>,
): number {
  let shared = 0;

  for (const value of left) {
    if (right.has(value) && !excluded.has(value)) {
      shared += 1;
    }
  }

  return shared;
}

function frequentTerms(sets: readonly ReadonlySet<string>[]): Set<string> {
  const counts = new Map<string, number>();

  for (const set of sets) {
    for (const value of set) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }

  return new Set(
    [...counts]
      .filter(([, count]) => count >= UMBRELLA_MIN_COUNT && count / sets.length > UMBRELLA_SHARE)
      .map(([value]) => value),
  );
}

export function findUmbrellaTerms(signals: readonly ArticleSignals[]): UmbrellaTerms {
  if (signals.length < UMBRELLA_MIN_FACTS) {
    return NO_UMBRELLA_TERMS;
  }

  const phrases = frequentTerms(signals.map((signal) => signal.phrases));
  const names = frequentTerms(signals.map((signal) => signal.names));

  for (const signal of signals) {
    for (const name of signal.names) {
      if (!name.includes(" ") && phrases.has(phraseStem(name))) {
        names.add(name);
      }
    }
  }

  return { names, phrases };
}

export function sharesName(
  left: ArticleSignals,
  right: ArticleSignals,
  umbrella: UmbrellaTerms = NO_UMBRELLA_TERMS,
): boolean {
  return countShared(left.names, right.names, umbrella.names) >= 1;
}

export function sharesPhrases(
  left: ArticleSignals,
  right: ArticleSignals,
  umbrella: UmbrellaTerms = NO_UMBRELLA_TERMS,
): boolean {
  return countShared(left.phrases, right.phrases, umbrella.phrases) >= MIN_SHARED_PHRASES;
}

function attaches(article: ArticleSignals, match: StoryMatch, umbrella: UmbrellaTerms): boolean {
  return (
    match.score >= STORY_ATTACH_SIMILARITY ||
    (match.score >= STORY_SIGNAL_SIMILARITY && sharesName(article, match.signals, umbrella)) ||
    (match.score >= STORY_PHRASE_SIMILARITY && sharesPhrases(article, match.signals, umbrella))
  );
}

export function isInStoryWindow(
  match: Pick<StoryMatch, "publishedAt">,
  publishedAt: string,
  storyArticleCount: number,
): boolean {
  const hours =
    storyArticleCount >= WIDE_WINDOW_MIN_ARTICLES ? STORY_WIDE_WINDOW_HOURS : STORY_WINDOW_HOURS;

  return (
    Math.abs(Date.parse(match.publishedAt) - Date.parse(publishedAt)) <= hours * 60 * 60 * 1000
  );
}

export function decideStory(
  article: ArticleSignals,
  matches: readonly StoryMatch[],
  umbrella: UmbrellaTerms = NO_UMBRELLA_TERMS,
): StoryDecision {
  const best = [...matches]
    .filter((match) => attaches(article, match, umbrella))
    .sort((left, right) => right.score - left.score)[0];

  return best ? { kind: "attach", storyId: best.storyId, score: best.score } : { kind: "open" };
}

export function storyWindow(publishedAt: string): { since: string; until: string } {
  const at = Date.parse(publishedAt);
  const span = STORY_WIDE_WINDOW_HOURS * 60 * 60 * 1000;

  return {
    since: new Date(at - span).toISOString(),
    until: new Date(at + span).toISOString(),
  };
}
