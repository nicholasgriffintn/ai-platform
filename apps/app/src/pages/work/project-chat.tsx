import { ProjectConversationPage } from "@ngriffin_uk/polychat-component-shell";
import { useParams } from "react-router";

export function meta() {
  return [{ title: "Task run - Polychat" }];
}

export default function ProjectTaskRunPage() {
  const { workspaceId = "", projectId = "", conversationId = "" } = useParams();

  return (
    <ProjectConversationPage
      workspaceId={workspaceId}
      projectId={projectId}
      conversationId={conversationId}
    />
  );
}
