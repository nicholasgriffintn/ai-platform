import {
  PROJECT_TASK_DEFAULT_CAPABILITIES,
  type ProjectCapability,
  type ProjectTaskCapability,
} from "@ngriffin_uk/polychat-schemas";

import { useAgents } from "~/hooks/useAgents";

const TOOL_CAPABILITY_HINTS: Record<string, ProjectTaskCapability> = {
  web_search: "web_access",
  web_fetch: "web_access",
  extract_content: "web_access",
  call_api: "web_access",
  run_sandbox_task: "code_execution",
  apply_edit: "file_editing",
  create_note: "file_editing",
  use_recipe_connector: "external_actions",
  trigger_recipe: "external_actions",
};

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

export function useProjectTaskDefaults(
  capabilities: ProjectCapability[] | undefined,
  agents: { id: string; name: string }[],
  hasCodingEnvironment: boolean,
) {
  const granted = new Set<ProjectTaskCapability>(PROJECT_TASK_DEFAULT_CAPABILITIES);

  if (hasCodingEnvironment) {
    granted.add("code_execution");
  }

  for (const capability of capabilities ?? []) {
    if (capability.kind !== "tool") {
      continue;
    }

    const hint = TOOL_CAPABILITY_HINTS[capability.capabilityId];

    if (hint) {
      granted.add(hint);
    }
  }

  return {
    capabilities: [...granted],
    agentId: agents.length === 1 ? agents[0].id : null,
    effort: "standard" as const,
  };
}
