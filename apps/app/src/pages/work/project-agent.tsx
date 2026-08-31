import { useParams } from "react-router";

import { AgentEditorPage } from "~/components/Agents/AgentEditorPage";

export function meta() {
  return [{ title: "Configure an agent - Polychat" }];
}

export default function ProjectAgentPage() {
  const { workspaceId = "", projectId = "", agentId = "" } = useParams();
  const projectPath = `/work/${workspaceId}/projects/${projectId}`;

  return (
    <AgentEditorPage
      agentId={agentId}
      agentsPath={`${projectPath}/agents`}
      backPath={`${projectPath}/library`}
      backLabel="Back to capabilities"
      projectId={projectId}
    />
  );
}
