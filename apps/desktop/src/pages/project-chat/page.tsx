import { ProjectConversationPage } from "@ngriffin_uk/polychat-component-shell";
import { useParams } from "react-router";

export default function DesktopProjectChatPage() {
  const { workspaceId = "", projectId = "", conversationId } = useParams();

  return (
    <ProjectConversationPage
      workspaceId={workspaceId}
      projectId={projectId}
      conversationId={conversationId}
    />
  );
}
