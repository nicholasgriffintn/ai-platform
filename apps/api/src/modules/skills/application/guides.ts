import { findSkillGuide, listSkillGuides } from "@ngriffin_uk/polychat-library-skills-catalogue";
import { listPageOf, type ListPage, type SkillGuide } from "@ngriffin_uk/polychat-schemas";

import type { PerMessageSkill } from "~/modules/skills/application/per-message";
import type { CoreChatOptions } from "~/types";

export async function listGuides(): Promise<ListPage<SkillGuide>> {
  return listPageOf(listSkillGuides(), (guide) => guide.place);
}

export function resolveTurnGuide(options: CoreChatOptions): PerMessageSkill | null {
  const place = options.poly?.ui_context?.place;
  const found = place ? findSkillGuide(place) : null;

  return found ? { id: found.guide.skillId, name: found.guide.name, body: found.body } : null;
}

export function withTurnGuide(
  guide: PerMessageSkill | null,
  skills: readonly PerMessageSkill[],
): PerMessageSkill[] {
  return guide ? [guide, ...skills.filter((skill) => skill.id !== guide.id)] : [...skills];
}
