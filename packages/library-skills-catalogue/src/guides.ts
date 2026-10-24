import {
  polyPlaceSchema,
  SKILL_GUIDE_MAX_STARTERS,
  type SkillGuide,
} from "@ngriffin_uk/polychat-schemas";

import type { SkillCatalog } from "./catalogue.js";
import { getBuiltInSkillCatalogue } from "./catalogue.js";
import type { SkillContent, SkillDefinition } from "./types.js";

const GUIDE_PLACE_METADATA_KEY = "polychat-guide-place";
const OPENING_HEADING = "Opening";
const STARTERS_HEADING = "Starters";

function readSection(body: string, heading: string): string | null {
  const lines = body.split(/\r?\n/u);
  const start = lines.findIndex((line) => line.trim() === `## ${heading}`);

  if (start === -1) {
    return null;
  }

  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => line.startsWith("# ") || line.startsWith("## "));
  const section = (end === -1 ? rest : rest.slice(0, end)).join("\n").trim();

  return section || null;
}

function readBulletList(section: string | null): string[] {
  if (!section) {
    return [];
  }

  return section
    .split(/\r?\n/u)
    .map((line) => line.trimStart())
    .filter((line) => line.startsWith("- ") || line.startsWith("* "))
    .map((line) => line.slice(2).trim())
    .filter(Boolean);
}

export function readSkillGuide(definition: SkillDefinition, content: SkillContent): SkillGuide {
  const place = polyPlaceSchema.safeParse(content.metadata?.[GUIDE_PLACE_METADATA_KEY]);

  if (!place.success) {
    throw new Error(`Guide ${definition.id} must name a place in ${GUIDE_PLACE_METADATA_KEY}`);
  }

  const opening = readSection(content.body, OPENING_HEADING);

  if (!opening) {
    throw new Error(`Guide ${definition.id} must have a ## ${OPENING_HEADING} section`);
  }

  return {
    place: place.data,
    skillId: definition.id,
    name: definition.name,
    opening,
    starters: readBulletList(readSection(content.body, STARTERS_HEADING)).slice(
      0,
      SKILL_GUIDE_MAX_STARTERS,
    ),
  };
}

export function listSkillGuides(catalog: SkillCatalog = getBuiltInSkillCatalogue()): SkillGuide[] {
  return catalog
    .listDefinitions()
    .filter((definition) => definition.category === "Guide")
    .flatMap((definition) => {
      const content = catalog.load(definition.id);

      return content ? [readSkillGuide(definition, content)] : [];
    });
}

export function findSkillGuide(
  place: SkillGuide["place"],
  catalog: SkillCatalog = getBuiltInSkillCatalogue(),
): { guide: SkillGuide; body: string } | null {
  const guide = listSkillGuides(catalog).find((candidate) => candidate.place === place);
  const content = guide ? catalog.load(guide.skillId) : null;

  return guide && content ? { guide, body: content.body } : null;
}
