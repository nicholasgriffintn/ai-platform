import {
  DISCOVER_INTEREST_EVIDENCE_LIMIT,
  type DiscoverInterestInference,
  type DiscoverInterestProfile,
} from "@ngriffin_uk/polychat-schemas";
import { shiftCalendarDate } from "@ngriffin_uk/polychat-utility-core";

import { discoverTopicKey } from "./edition";

export const DISCOVER_RESEARCH_TOPIC_LIMIT = 8;
export const INTEREST_OPENED_DAYS = 7;
const ROTATING_INTEREST_LIMIT = 2;
const INTEREST_REST_DAYS = 3;
const OPENED_WEIGHT = 0.25;
const OPENED_WEIGHT_CAP = 1;
const INTEREST_KEPT_DAYS = 14;
const INTEREST_PROFILE_LIMIT = 12;

type ProfileInterest = DiscoverInterestProfile["interests"][number];

export interface DiscoverResearchTopicsInput {
  followed: readonly string[];
  asked: readonly string[];
  more: readonly string[];
  saved: readonly string[];
  inferred: readonly ProfileInterest[];
  engaged: ReadonlyMap<string, number>;
  researchedOn: ReadonlyMap<string, string>;
  hidden: readonly string[];
  today: string;
}

interface RotatingInterest {
  interest: ProfileInterest;
  researchedToday: boolean;
  weight: number;
}

function byStrength(left: ProfileInterest, right: ProfileInterest): number {
  if (left.lastSeen !== right.lastSeen) {
    return left.lastSeen < right.lastSeen ? 1 : -1;
  }

  return right.days - left.days;
}

function countEvidenceServices(interest: ProfileInterest): number {
  return new Set(interest.evidence.map((line) => line.split(":")[0]?.trim().toLowerCase())).size;
}

function byRotation(left: RotatingInterest, right: RotatingInterest): number {
  if (left.researchedToday !== right.researchedToday) {
    return left.researchedToday ? -1 : 1;
  }

  return right.weight - left.weight || byStrength(left.interest, right.interest);
}

function chooseRotatingInterests(
  input: DiscoverResearchTopicsInput,
  taken: ReadonlySet<string>,
): string[] {
  const restingSince = shiftCalendarDate(input.today, -INTEREST_REST_DAYS);

  return input.inferred
    .flatMap((interest): RotatingInterest[] => {
      const key = discoverTopicKey(interest.topic);
      const researchedOn = input.researchedOn.get(key);
      const resting = researchedOn && researchedOn < input.today && researchedOn > restingSince;

      if (!key || taken.has(key) || resting || interest.lastSeen <= restingSince) {
        return [];
      }

      return [
        {
          interest,
          researchedToday: researchedOn === input.today,
          weight:
            countEvidenceServices(interest) +
            Math.min(OPENED_WEIGHT_CAP, (input.engaged.get(key) ?? 0) * OPENED_WEIGHT),
        },
      ];
    })
    .sort(byRotation)
    .slice(0, ROTATING_INTEREST_LIMIT)
    .map((rotating) => rotating.interest.topic);
}

export function chooseResearchTopics(input: DiscoverResearchTopicsInput): string[] {
  const taken = new Set(input.hidden.map(discoverTopicKey));
  const topics: string[] = [];
  const add = (topic: string) => {
    const key = discoverTopicKey(topic);

    if (key && !taken.has(key) && topics.length < DISCOVER_RESEARCH_TOPIC_LIMIT) {
      taken.add(key);
      topics.push(topic.trim());
    }
  };

  for (const topic of [...input.followed, ...input.asked, ...input.more, ...input.saved]) {
    add(topic);
  }

  for (const topic of chooseRotatingInterests(input, taken)) {
    add(topic);
  }

  return topics;
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
