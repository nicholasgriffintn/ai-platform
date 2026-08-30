import type { ProjectCapability } from "@ngriffin_uk/polychat-schemas";

import { useAgents } from "~/hooks/useAgents";

export function useProjectTaskAgents(capabilities: ProjectCapability[] | undefined) {
  const { agents } = useAgents();
  const attached = new Set(
    (capabilities ?? [])
      .filter((capability) => capability.kind === "agent")
      .map((capability) => capability.capabilityId),
  );

  return ((agents ?? []) as { id: string; name?: string | null }[])
    .filter((agent) => attached.has(agent.id))
    .map((agent) => ({ id: agent.id, name: agent.name ?? agent.id }));
}
