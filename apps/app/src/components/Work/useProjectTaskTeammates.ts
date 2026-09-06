import type { ProjectCapability, SkillSummary } from "@ngriffin_uk/polychat-schemas";

import { useTeammates } from "~/hooks/useTeammates";

export function useProjectTaskTeammates(capabilities: ProjectCapability[] | undefined) {
  const { agents } = useTeammates();
  const attached = new Set(
    (capabilities ?? [])
      .filter((capability) => capability.kind === "agent")
      .map((capability) => capability.capabilityId),
  );

  return (agents ?? [])
    .filter((agent) => attached.has(agent.id))
    .map((agent) => ({ id: agent.id, name: agent.name ?? agent.id }));
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
