import { WorkPlaceShell, WorkspaceMembers } from "@ngriffin_uk/polychat-component-shell";
import { useParams } from "react-router";

export default function DesktopWorkspaceMembersPage() {
  const { workspaceId = "" } = useParams();

  return (
    <WorkPlaceShell>
      <WorkspaceMembers workspaceId={workspaceId} />
    </WorkPlaceShell>
  );
}
