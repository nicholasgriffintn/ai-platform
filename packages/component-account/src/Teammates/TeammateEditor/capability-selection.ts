import type { SkillSummary, Tool } from "@ngriffin_uk/polychat-schemas";
import { compareNaturalText } from "@ngriffin_uk/polychat-utility-core";

export type TeammateCapabilityKind = "tool" | "skill";

export interface TeammateCapabilityOption {
  id: string;
  kind: TeammateCapabilityKind;
  name: string;
  description: string;
  category: string;
}

export const TEAMMATE_CAPABILITY_KINDS: readonly TeammateCapabilityKind[] = ["skill", "tool"];

export function toTeammateCapabilityOptions(
  tools: readonly Tool[],
  skills: readonly SkillSummary[],
): TeammateCapabilityOption[] {
  return [
    ...tools.map((tool) => ({
      id: tool.id,
      kind: "tool" as const,
      name: tool.name,
      description: tool.description,
      category: tool.category,
    })),
    ...skills.map((skill) => ({
      id: skill.id,
      kind: "skill" as const,
      name: skill.name,
      description: skill.description,
      category: skill.category,
    })),
  ];
}

export function getTeammateCapabilityCategories(
  options: readonly TeammateCapabilityOption[],
): string[] {
  return [...new Set(options.map((option) => option.category))].sort(compareNaturalText);
}

export function filterTeammateCapabilityOptions(
  options: readonly TeammateCapabilityOption[],
  { category, kind, query }: { category: string; kind: TeammateCapabilityKind; query: string },
): TeammateCapabilityOption[] {
  const search = query.trim().toLowerCase();

  return options.filter((option) => {
    if (option.kind !== kind) {
      return false;
    }

    if (category !== "all" && option.category !== category) {
      return false;
    }

    if (!search) {
      return true;
    }

    return (
      option.name.toLowerCase().includes(search) ||
      option.description.toLowerCase().includes(search)
    );
  });
}
