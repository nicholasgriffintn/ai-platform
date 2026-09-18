import {
  getBuiltInSkillDefinition,
  getBuiltInSkillResource,
  listBuiltInSkillDefinitions,
  listBuiltInSkillSummaries,
  loadBuiltInSkill,
  type SkillContent,
  type SkillDefinition,
  type SkillResource,
} from "@ngriffin_uk/polychat-library-skills-catalogue";
import type { SkillSummary } from "@ngriffin_uk/polychat-schemas";

export function listSkills(): SkillDefinition[] {
  return listBuiltInSkillDefinitions();
}

export function listSkillSummaries(): SkillSummary[] {
  return listBuiltInSkillSummaries();
}

export function getSkill(skillId: string): SkillDefinition | undefined {
  return getBuiltInSkillDefinition(skillId);
}

export function loadSkill(skillId: string): SkillContent | null {
  return loadBuiltInSkill(skillId);
}

export function getSkillResource(skillId: string, path: string): SkillResource | null {
  return getBuiltInSkillResource(skillId, path);
}

export function requireSkill(skillId: string): SkillDefinition {
  const skill = getSkill(skillId);

  if (!skill) {
    throw new Error(`Unknown skill: ${skillId}`);
  }

  return skill;
}
