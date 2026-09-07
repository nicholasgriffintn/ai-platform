import { WorkspaceMembers } from "@ngriffin_uk/polychat-component-shell";
import { useParams } from "react-router";

export default function DesktopWorkspaceMembersPage() {
  const { workspaceId = "" } = useParams();

  return <WorkspaceMembers workspaceId={workspaceId} />;
}
