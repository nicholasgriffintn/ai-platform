import { useParams } from "react-router";

import { AgentEditorPage } from "~/components/Agents/AgentEditorPage";

export function meta() {
  return [{ title: "Configure an agent - Polychat" }];
}

export default function PersonalAgentPage() {
  const { agentId = "" } = useParams();

  return (
    <AgentEditorPage
      agentId={agentId}
      agentsPath="/chat/agents"
      backPath="/chat/capabilities"
      backLabel="Back to capabilities"
    />
  );
}
