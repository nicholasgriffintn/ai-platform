import type { StoryEntityKind, StoryEntityRole } from "@ngriffin_uk/polychat-schemas";
import {
  escapeRegExp,
  isCountryName,
  isGenericRoleNoun,
  normaliseComparableText,
  sha256Hex,
} from "@ngriffin_uk/polychat-utility-core";

export const STORY_LEAD_ENTITY_LIMIT = 3;

const ROLE_RANK: Record<StoryEntityRole, number> = { subject: 0, quoted: 1, mentioned: 2 };
const LEADING_WORDS = new Set(["the", "a", "an"]);
const TITLE_WORDS = new Set([
  "pope",
  "king",
  "queen",
  "prince",
  "princess",
  "president",
  "prime",
  "minister",
  "chancellor",
  "sir",
  "dame",
  "dr",
  "judge",
]);
const REGNAL_NUMBER = /^[ivxlc]+$/u;
const TRAILING_WORDS = new Set([
  "inc",
  "incorporated",
  "ltd",
  "limited",
  "plc",
  "llc",
  "corp",
  "corporation",
  "co",
  "company",
  "group",
  "holdings",
  "ceo",
  "cfo",
  "chief",
  "exec",
  "executive",
  "boss",
  "founder",
  "chairman",
  "chairwoman",
  "spokesman",
  "spokeswoman",
  "spokesperson",
]);

export interface EntityCandidate {
  name: string;
  kind: StoryEntityKind;
  role: StoryEntityRole;
}

export interface MergedEntity {
  key: string;
  name: string;
  kind: StoryEntityKind;
  role: StoryEntityRole;
  aliases: string[];
}

export function entityKey(name: string): string {
  const owner = name.split(/['’]s\s+/u).at(-1) ?? name;
  const words = normaliseComparableText(owner).split(" ").filter(Boolean);

  while (words.length > 1 && LEADING_WORDS.has(words[0] ?? "")) {
    words.shift();
  }

  while (words.length > 1 && TRAILING_WORDS.has(words.at(-1) ?? "")) {
    words.pop();
  }

  if (words.length > 2 && REGNAL_NUMBER.test(words.at(-1) ?? "")) {
    words.pop();
  }

  while (words.length > 2 && TITLE_WORDS.has(words[0] ?? "")) {
    words.shift();
  }

  return words.join(" ");
}

export async function entityId(key: string): Promise<string> {
  return `entity_${(await sha256Hex(key)).slice(0, 24)}`;
}

function isGenericName(name: string): boolean {
  const words = name.split(/\s+/u);
  const rest = LEADING_WORDS.has(words[0]?.toLowerCase() ?? "") ? words.slice(1) : words;

  return !rest.some((word) => /\p{Lu}/u.test(word) || /\p{N}/u.test(word));
}

function appearsUncapitalised(name: string, corpus: string): boolean {
  const lower = name.toLowerCase();

  return (
    lower !== name &&
    new RegExp(`(^|[^\\p{L}])${escapeRegExp(lower)}(?=[^\\p{L}]|$)`, "u").test(corpus)
  );
}

export function isGenericEntity(name: string, corpus = ""): boolean {
  return (
    name.includes(",") ||
    isGenericName(name) ||
    isGenericRoleNoun(name) ||
    appearsUncapitalised(name, corpus)
  );
}

function splitListedNames(candidates: readonly EntityCandidate[]): EntityCandidate[] {
  return candidates.flatMap((candidate) =>
    candidate.name
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean)
      .map((name) => ({ ...candidate, name })),
  );
}

export function correctEntityKind(name: string, kind: StoryEntityKind): StoryEntityKind {
  return isCountryName(name) ? "place" : kind;
}

export function mergeEntityCandidates(
  candidates: readonly EntityCandidate[],
  corpus = "",
): MergedEntity[] {
  const merged = new Map<string, MergedEntity>();

  for (const candidate of splitListedNames(candidates)) {
    const name = candidate.name.trim();
    const key = entityKey(name);

    if (key.length < 2 || isGenericEntity(name, corpus)) {
      continue;
    }

    const existing = merged.get(key);
    const kind = correctEntityKind(name, candidate.kind);

    if (!existing) {
      merged.set(key, { key, name, kind, role: candidate.role, aliases: [name] });
      continue;
    }

    if (!existing.aliases.includes(name)) {
      existing.aliases.push(name);
    }

    if (name.length < existing.name.length) {
      existing.name = name;
    }

    if (ROLE_RANK[candidate.role] < ROLE_RANK[existing.role]) {
      existing.role = candidate.role;
    }
  }

  return [...merged.values()];
}

export function pickLeadEntities(entities: readonly MergedEntity[]): MergedEntity[] {
  return [...entities]
    .filter((entity) => entity.role !== "mentioned")
    .sort((left, right) => ROLE_RANK[left.role] - ROLE_RANK[right.role])
    .slice(0, STORY_LEAD_ENTITY_LIMIT);
}
