import { useParams } from "react-router";

import { ChatConversationShell } from "../Shell/ChatConversationShell.js";
import { TeammateHomePage } from "../Teammates/TeammateHomePage.js";
import { getPlaceScopePaths, usePlaceScope } from "./place-scope.js";

export function TeammatePlace() {
  const scope = usePlaceScope();
  const { teammateId = "" } = useParams();
  const { teammates } = getPlaceScopePaths(scope);

  if (scope.kind === "project") {
    return (
      <TeammateHomePage
        teammateId={teammateId}
        teammatesPath={teammates}
        backPath={teammates}
        projectId={scope.projectId}
      />
    );
  }

  return (
    <ChatConversationShell title="Teammate">
      <TeammateHomePage teammateId={teammateId} teammatesPath={teammates} backPath={teammates} />
    </ChatConversationShell>
  );
}
