import { ProjectConversationPage } from "@ngriffin_uk/polychat-component-shell";
import {
  getProjectConversationPath,
  readLegacyConversationQuery,
} from "@ngriffin_uk/polychat-library-react";
import { Navigate, useLocation, useParams } from "react-router";

export function meta() {
  return [{ title: "Project conversation - Polychat" }];
}

export default function ProjectChatPage() {
  const { workspaceId = "", projectId = "", conversationId } = useParams();
  const { search } = useLocation();
  const legacyConversationId = conversationId ? undefined : readLegacyConversationQuery(search);

  if (legacyConversationId) {
    return (
      <Navigate
        to={getProjectConversationPath(workspaceId, projectId, legacyConversationId)}
        replace
      />
    );
  }

  return (
    <ProjectConversationPage
      workspaceId={workspaceId}
      projectId={projectId}
      conversationId={conversationId}
    />
  );
}
