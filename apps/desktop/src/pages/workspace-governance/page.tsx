import { WorkPlaceShell, WorkspaceGovernance } from "@ngriffin_uk/polychat-component-shell";
import { useParams } from "react-router";

export default function DesktopWorkspaceGovernancePage() {
  const { workspaceId = "" } = useParams();

  return (
    <WorkPlaceShell>
      <WorkspaceGovernance workspaceId={workspaceId} />
    </WorkPlaceShell>
  );
}
