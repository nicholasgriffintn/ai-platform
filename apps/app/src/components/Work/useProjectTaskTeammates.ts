import type { ProjectCapability, SkillSummary } from "@ngriffin_uk/polychat-schemas";

import { useTeammates } from "~/hooks/useTeammates";

export function useProjectTaskTeammates(capabilities: ProjectCapability[] | undefined) {
  const { teammates } = useTeammates();
  const attached = new Set(
    (capabilities ?? [])
      .filter((capability) => capability.kind === "teammate")
      .map((capability) => capability.capabilityId),
  );

  return (teammates ?? [])
    .filter((teammate) => attached.has(teammate.id))
    .map((teammate) => ({ id: teammate.id, name: teammate.name ?? teammate.id }));
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
