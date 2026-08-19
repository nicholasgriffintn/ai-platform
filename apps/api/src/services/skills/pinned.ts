import type { SkillAvailability } from "@ngriffin_uk/polychat-schemas";

import { loadSkill, type SkillCatalog } from "./catalog";
import type { SkillContent } from "./types";

export const MAX_PINNED_SKILLS = 4;

/**
 * Pinning is a presentation choice, not an authorisation one: a skill the scope has not made
 * ready is never loaded up front, however the request asks for it.
 */
export async function resolvePinnedSkillContent(params: {
  requested?: readonly string[];
  available: readonly SkillAvailability[];
  catalog?: SkillCatalog | null;
}): Promise<SkillContent[]> {
  const requested = params.requested ?? [];

  if (requested.length === 0) {
    return [];
  }

  const readyIds = new Set(
    params.available.filter((skill) => skill.state === "ready").map((skill) => skill.id),
  );
  const seen = new Set<string>();
  const pinned: SkillContent[] = [];

  for (const skillId of requested) {
    if (pinned.length >= MAX_PINNED_SKILLS || seen.has(skillId) || !readyIds.has(skillId)) {
      continue;
    }

    seen.add(skillId);

    const content = params.catalog ? params.catalog.load(skillId) : await loadSkill(skillId);

    if (content) {
      pinned.push(content);
    }
  }

  return pinned;
}
