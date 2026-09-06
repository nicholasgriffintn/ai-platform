import { Navigate, useLocation, useParams } from "react-router";

import { ProjectConversationPage } from "~/components/Work/ProjectConversationPage";
import { getProjectConversationPath, readLegacyConversationQuery } from "~/lib/conversation-route";

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
