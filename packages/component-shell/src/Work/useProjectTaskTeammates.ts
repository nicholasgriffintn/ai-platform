import { useTeammates } from "@ngriffin_uk/polychat-library-react";
import { isPlatformTeammateId, PLATFORM_TEAMMATES } from "@ngriffin_uk/polychat-schemas";
import type { ProjectCapability, SkillSummary } from "@ngriffin_uk/polychat-schemas";

export function useProjectTaskTeammates(capabilities: ProjectCapability[] | undefined) {
  const { teammates } = useTeammates();
  const attached = new Set(
    (capabilities ?? [])
      .filter((capability) => capability.kind === "teammate")
      .map((capability) => capability.capabilityId),
  );
  const entries = new Map(
    PLATFORM_TEAMMATES.map((teammate) => [teammate.id, { id: teammate.id, name: teammate.name }]),
  );

  for (const teammate of teammates ?? []) {
    if (attached.has(teammate.id) || isPlatformTeammateId(teammate.id)) {
      entries.set(teammate.id, { id: teammate.id, name: teammate.name ?? teammate.id });
    }
  }

  return [...entries.values()];
}

export function projectTaskSkills(
  capabilities: ProjectCapability[] | undefined,
  skills: SkillSummary[] | undefined,
) {
  const attached = new Set(
    (capabilities ?? [])
      .filter((capability) => capability.kind === "skill")
      .map((capability) => capability.capabilityId),
  );

  return (skills ?? [])
    .filter((skill) => attached.has(skill.id))
    .map((skill) => ({ id: skill.id, name: skill.name }));
}
