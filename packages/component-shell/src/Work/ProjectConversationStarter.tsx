import { ProjectConversationStarter as ControlledProjectConversationStarter } from "@ngriffin_uk/polychat-component-workspaces";
import { createAssistantActionConversationUrl } from "@ngriffin_uk/polychat-library-react";
import { useNavigate } from "react-router";

export function ProjectConversationStarter({
  workspaceId,
  projectId,
}: {
  workspaceId: string;
  projectId: string;
}) {
  const navigate = useNavigate();

  return (
    <ControlledProjectConversationStarter
      onStart={(prompt) => {
        void navigate(
          createAssistantActionConversationUrl(
            { input: prompt, enabledTools: [] },
            `/work/${workspaceId}/projects/${projectId}/chat`,
          ),
        );
      }}
    />
  );
}
