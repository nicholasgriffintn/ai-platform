import { useParams } from "react-router";

import { AgentEditorPage } from "~/components/Agents/AgentEditorPage";
import { PLACE_PATHS } from "~/lib/navigation/places";

export function meta() {
  return [{ title: "Configure an agent - Polychat" }];
}

export default function PersonalAgentPage() {
  const { agentId = "" } = useParams();

  return (
    <AgentEditorPage
      agentId={agentId}
      agentsPath="/chat/agents"
      backPath={PLACE_PATHS.library}
      backLabel="Back to capabilities"
    />
  );
}
