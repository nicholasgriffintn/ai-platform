import {
  DISCOVER_EDITION_VERSION,
  type ComposeDiscoverEditionInput,
  type DiscoverCard,
  type DiscoverCardDraft,
  type DiscoverEditionContent,
  type DiscoverEditionTime,
} from "@ngriffin_uk/polychat-schemas";
import { comparableHttpUrl, normaliseComparableText } from "@ngriffin_uk/polychat-utility-core";

export interface BuildDiscoverEditionInput {
  draft: ComposeDiscoverEditionInput;
  date: string;
  timezone: string;
  generatedAt: string;
  hiddenTopics: ReadonlySet<string>;
  followedTopics: ReadonlySet<string>;
  curate: string;
  resurfaceHrefs: ReadonlySet<string>;
  recentUrls: ReadonlySet<string>;
  createId: () => string;
}

export function discoverTopicKey(topic: string): string {
  return normaliseComparableText(topic);
}

export function discoverEditionGroupId(
  date: string,
  edition: DiscoverEditionTime = "morning",
): string {
  return edition === "evening" ? `discover:${date}:evening` : `discover:${date}`;
}

export function discoverEditionTimeAt(hour: number): DiscoverEditionTime {
  return hour >= 15 ? "evening" : "morning";
}

function cardTopic(card: DiscoverCardDraft): string | null {
  return "topic" in card ? card.topic : null;
}

export function discoverCardUrl(card: DiscoverCardDraft): string | null {
  return "url" in card && typeof card.url === "string" ? card.url : null;
}

function isHidden(topic: string | null, hiddenTopics: ReadonlySet<string>): boolean {
  return topic !== null && hiddenTopics.has(discoverTopicKey(topic));
}

function wasAskedFor(topic: string | null, input: BuildDiscoverEditionInput): boolean {
  if (topic === null) {
    return false;
  }

  const key = discoverTopicKey(topic);

  return input.followedTopics.has(key) || normaliseComparableText(input.curate).includes(key);
}

function isWithheld(
  item: { sensitive: boolean },
  topic: string | null,
  input: BuildDiscoverEditionInput,
): boolean {
  return item.sensitive && !wasAskedFor(topic, input);
}

export function buildDiscoverEdition(input: BuildDiscoverEditionInput): DiscoverEditionContent {
  const seenUrls = new Set(input.recentUrls);
  const cards: DiscoverCard[] = [];

  for (const card of input.draft.cards) {
    if (isHidden(cardTopic(card), input.hiddenTopics) || isWithheld(card, cardTopic(card), input)) {
      continue;
    }

    if (card.kind === "resurface" && !input.resurfaceHrefs.has(card.href)) {
      continue;
    }

    const linked = discoverCardUrl(card);

    if (linked) {
      const url = comparableHttpUrl(linked);

      if (!url || seenUrls.has(url)) {
        continue;
      }

      seenUrls.add(url);
    }

    cards.push({ ...card, id: input.createId() });
  }

  return {
    version: DISCOVER_EDITION_VERSION,
    date: input.date,
    timezone: input.timezone,
    greeting: input.draft.greeting,
    interests: input.draft.interests.filter(
      (interest) =>
        !isHidden(interest.topic, input.hiddenTopics) &&
        !isWithheld(interest, interest.topic, input),
    ),
    brief: input.draft.brief,
    cards,
    generatedAt: input.generatedAt,
  };
}

export function listEditionUrls(editions: readonly DiscoverEditionContent[]): Set<string> {
  const urls = new Set<string>();

  for (const edition of editions) {
    for (const card of edition.cards) {
      const linked = discoverCardUrl(card);
      const url = linked ? comparableHttpUrl(linked) : null;

      if (url) {
        urls.add(url);
      }
    }
  }

  return urls;
}

export function describeDiscoverCard(card: DiscoverCard): string {
  return card.kind === "check_in" ? card.question : card.title;
}

export function discoverCardTopic(card: DiscoverCard): string | null {
  return "topic" in card ? card.topic : null;
}
