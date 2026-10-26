import { ProjectConversationPage } from "@ngriffin_uk/polychat-component-shell";
import { Navigate, useParams } from "react-router";

export function meta() {
  return [{ title: "Task run - Polychat" }];
}

export default function ProjectTaskRunPage() {
  const { workspaceId = "", projectId = "", conversationId } = useParams();

  if (!conversationId) {
    return <Navigate to={`/work/${workspaceId}/projects/${projectId}?new=1`} replace />;
  }

  return (
    <ProjectConversationPage
      workspaceId={workspaceId}
      projectId={projectId}
      conversationId={conversationId}
    />
  );
}
