import {
  DISCOVER_INTEREST_EVIDENCE_LIMIT,
  type DiscoverInterestInference,
  type DiscoverInterestProfile,
} from "@ngriffin_uk/polychat-schemas";
import { shiftCalendarDate } from "@ngriffin_uk/polychat-utility-core";

import { discoverTopicKey } from "./edition";

export const DISCOVER_RESEARCH_TOPIC_LIMIT = 8;
export const DISCOVER_INFERRED_INTEREST_LIMIT = 4;
const INTEREST_KEPT_DAYS = 14;
const INTEREST_PROFILE_LIMIT = 12;

type ProfileInterest = DiscoverInterestProfile["interests"][number];

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

function byStrength(left: ProfileInterest, right: ProfileInterest): number {
  if (left.lastSeen !== right.lastSeen) {
    return left.lastSeen < right.lastSeen ? 1 : -1;
  }

  return right.days - left.days;
}

function strengthen(
  kept: ProfileInterest | undefined,
  found: DiscoverInterestInference["interests"][number],
  today: string,
): ProfileInterest {
  if (!kept) {
    return {
      topic: found.topic.trim(),
      evidence: found.evidence.slice(0, DISCOVER_INTEREST_EVIDENCE_LIMIT),
      firstSeen: today,
      lastSeen: today,
      days: 1,
    };
  }

  return {
    ...kept,
    evidence: [...new Set([...found.evidence, ...kept.evidence])].slice(
      0,
      DISCOVER_INTEREST_EVIDENCE_LIMIT,
    ),
    lastSeen: today,
    days: kept.lastSeen === today ? kept.days : kept.days + 1,
  };
}

export function mergeInterestProfile(
  profile: DiscoverInterestProfile | null,
  found: DiscoverInterestInference["interests"],
  { today, hidden }: { today: string; hidden: readonly string[] },
): DiscoverInterestProfile {
  const hiddenKeys = new Set(hidden.map(discoverTopicKey));
  const earliest = shiftCalendarDate(today, -INTEREST_KEPT_DAYS);
  const interests = new Map(
    (profile?.interests ?? []).map((interest) => [discoverTopicKey(interest.topic), interest]),
  );

  for (const interest of found) {
    const key = discoverTopicKey(interest.topic);

    if (key) {
      interests.set(key, strengthen(interests.get(key), interest, today));
    }
  }

  return {
    updatedOn: today,
    interests: [...interests.entries()]
      .filter(([key, interest]) => !hiddenKeys.has(key) && interest.lastSeen >= earliest)
      .map(([, interest]) => interest)
      .sort(byStrength)
      .slice(0, INTEREST_PROFILE_LIMIT),
  };
}

export function rankInterestProfile(profile: DiscoverInterestProfile | null): string[] {
  return [...(profile?.interests ?? [])].sort(byStrength).map((interest) => interest.topic);
}

function describeProfileInterest(interest: ProfileInterest): string {
  return `${interest.topic}: seen on ${interest.days} ${interest.days === 1 ? "day" : "days"}, last ${interest.lastSeen}. ${interest.evidence.join("; ")}`;
}

export function renderInterestProfile(profile: DiscoverInterestProfile): string {
  return [
    "# What Discover thinks you are into",
    `Updated ${profile.updatedOn}. Each interest lists the activity that shows it. Hide a topic in Discover to drop it.`,
    profile.interests.length > 0
      ? profile.interests.map((interest) => `- ${describeProfileInterest(interest)}`).join("\n")
      : "Nothing yet.",
  ].join("\n\n");
}

export function describeInterestMaterial(input: {
  signals: ReadonlyArray<{ title: string; lines: readonly string[] }>;
  chatTitles: readonly string[];
  memorySummary: string | null;
  more: readonly string[];
  less: readonly string[];
  profile: DiscoverInterestProfile | null;
}): string {
  const section = (title: string, lines: readonly string[]) =>
    [`## ${title}`, ...(lines.length > 0 ? lines.map((line) => `- ${line}`) : ["Nothing."])].join(
      "\n",
    );

  return [
    ...input.signals.map((signal) => section(`Lately on ${signal.title}`, signal.lines)),
    ...(input.signals.some((signal) => signal.lines.length > 0)
      ? []
      : [
          section(
            "Recent chat titles, only because no service has been read yet",
            input.chatTitles,
          ),
        ]),
    section("What Poly remembers", input.memorySummary ? [input.memorySummary] : []),
    section("Asked for more of", input.more),
    section("Asked for less of, never choose", input.less),
    section(
      "Their interest profile so far, with the evidence earlier days found",
      (input.profile?.interests ?? []).map(describeProfileInterest),
    ),
  ].join("\n\n");
}
