import { useParams } from "react-router";

import { ProjectConversationPage } from "~/components/Work/ProjectConversationPage";

export function meta() {
  return [{ title: "Project conversation - Polychat" }];
}

export default function ProjectChatPage() {
  const { workspaceId = "", projectId = "" } = useParams();

  return <ProjectConversationPage workspaceId={workspaceId} projectId={projectId} />;
}
