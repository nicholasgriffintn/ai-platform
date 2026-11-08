import type { StoryEntityKind, StoryEntityRole } from "@ngriffin_uk/polychat-schemas";
import { normaliseComparableText, sha256Hex } from "@ngriffin_uk/polychat-utility-core";

export const STORY_LEAD_ENTITY_LIMIT = 3;

const ROLE_RANK: Record<StoryEntityRole, number> = { subject: 0, quoted: 1, mentioned: 2 };
const LEADING_WORDS = new Set(["the", "a", "an"]);
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

  return words.join(" ");
}

export async function entityId(key: string): Promise<string> {
  return `entity_${(await sha256Hex(key)).slice(0, 24)}`;
}

export function mergeEntityCandidates(candidates: readonly EntityCandidate[]): MergedEntity[] {
  const merged = new Map<string, MergedEntity>();

  for (const candidate of candidates) {
    const name = candidate.name.trim();
    const key = entityKey(name);

    if (key.length < 2) {
      continue;
    }

    const existing = merged.get(key);

    if (!existing) {
      merged.set(key, { key, name, kind: candidate.kind, role: candidate.role, aliases: [name] });
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
