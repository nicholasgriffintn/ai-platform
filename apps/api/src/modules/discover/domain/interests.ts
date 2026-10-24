import { discoverTopicKey } from "./edition";

export const DISCOVER_RESEARCH_TOPIC_LIMIT = 8;
export const DISCOVER_INFERRED_INTEREST_LIMIT = 4;

export interface DiscoverResearchTopicsInput {
  followed: readonly string[];
  asked: readonly string[];
  more: readonly string[];
  inferred: readonly string[];
  hidden: readonly string[];
}

export function chooseResearchTopics(input: DiscoverResearchTopicsInput): string[] {
  const hidden = new Set(input.hidden.map(discoverTopicKey));
  const seen = new Set<string>();
  const topics: string[] = [];

  for (const topic of [
    ...input.followed,
    ...input.asked,
    ...input.more,
    ...input.inferred.slice(0, DISCOVER_INFERRED_INTEREST_LIMIT),
  ]) {
    const key = discoverTopicKey(topic);

    if (!key || hidden.has(key) || seen.has(key)) {
      continue;
    }

    seen.add(key);
    topics.push(topic.trim());

    if (topics.length >= DISCOVER_RESEARCH_TOPIC_LIMIT) {
      break;
    }
  }

  return topics;
}

export function describeInterestMaterial(input: {
  signals: ReadonlyArray<{ title: string; lines: readonly string[] }>;
  chatTitles: readonly string[];
  memorySummary: string | null;
  more: readonly string[];
  less: readonly string[];
  previous: readonly string[];
}): string {
  const section = (title: string, lines: readonly string[]) =>
    [`## ${title}`, ...(lines.length > 0 ? lines.map((line) => `- ${line}`) : ["Nothing."])].join(
      "\n",
    );

  return [
    ...input.signals.map((signal) => section(`Lately on ${signal.title}`, signal.lines)),
    section("Recent chat titles", input.chatTitles),
    section("What Poly remembers", input.memorySummary ? [input.memorySummary] : []),
    section("Asked for more of", input.more),
    section("Asked for less of, never choose", input.less),
    section("Used before", input.previous),
  ].join("\n\n");
}
