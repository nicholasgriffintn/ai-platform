import { useParams } from "react-router";

import { WorkspaceMembers } from "~/components/Work/WorkspaceMembers";

export function meta() {
  return [{ title: "Workspace people - Polychat" }];
}

export default function WorkspaceMembersPage() {
  const { workspaceId = "" } = useParams();

  return <WorkspaceMembers workspaceId={workspaceId} />;
}
