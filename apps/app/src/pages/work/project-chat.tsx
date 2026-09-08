import { ProjectConversationPage } from "@ngriffin_uk/polychat-component-shell";
import { useParams } from "react-router";

export function meta() {
  return [{ title: "Project conversation - Polychat" }];
}

export default function ProjectChatPage() {
  const { workspaceId = "", projectId = "", conversationId } = useParams();

  return (
    <ProjectConversationPage
      workspaceId={workspaceId}
      projectId={projectId}
      conversationId={conversationId}
    />
  );
}
