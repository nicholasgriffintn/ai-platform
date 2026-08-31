import type { AgentTeam, GroupedAgents } from "@ngriffin_uk/polychat-component-account";
import type { AgentResponse } from "@ngriffin_uk/polychat-schemas";
import { titleCaseSlug } from "@ngriffin_uk/polychat-utility-core";

function createTeam(teamId: string): AgentTeam {
  return {
    id: teamId,
    name: titleCaseSlug(teamId),
    orchestrator: null,
    members: [],
  };
}

export function groupAgents(agents: AgentResponse[]): GroupedAgents {
  const grouped: GroupedAgents = { teams: {}, individual: [] };

  for (const agent of agents) {
    if (!agent.is_team_agent || !agent.team_id) {
      grouped.individual.push(agent);
      continue;
    }

    const team = (grouped.teams[agent.team_id] ??= createTeam(agent.team_id));

    if (agent.team_role === "orchestrator") {
      team.orchestrator = agent;
      team.name = agent.name.replace(/orchestrator/i, "").trim() || team.name;
    } else {
      team.members.push(agent);
    }
  }

  return grouped;
}
