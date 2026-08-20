import type { SkillAvailability } from "@ngriffin_uk/polychat-schemas";

export function getSkillSuggestedToolNames(
  skills: readonly SkillAvailability[] | undefined,
): string[] {
  return Array.from(
    new Set(
      (skills ?? [])
        .filter((skill) => skill.state === "ready")
        .flatMap((skill) => skill.requirement.suggestedTools),
    ),
  );
}

export function mergeSkillSuggestedToolNames(params: {
  enabledTools?: readonly string[];
  skills?: readonly SkillAvailability[];
}): string[] {
  return Array.from(
    new Set([...(params.enabledTools ?? []), ...getSkillSuggestedToolNames(params.skills)]),
  );
}
