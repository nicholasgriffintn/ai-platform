import { WorkspaceMembers } from "@ngriffin_uk/polychat-component-shell";
import { useParams } from "react-router";

export function meta() {
  return [{ title: "Workspace people - Polychat" }];
}

export default function WorkspaceMembersPage() {
  const { workspaceId = "" } = useParams();

  return <WorkspaceMembers workspaceId={workspaceId} />;
}
