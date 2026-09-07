import { WorkPlaceShell, WorkspaceOverview } from "@ngriffin_uk/polychat-component-shell";
import { useParams } from "react-router";

export default function DesktopWorkspacePage() {
  const { workspaceId = "" } = useParams();

  return (
    <WorkPlaceShell>
      <WorkspaceOverview workspaceId={workspaceId} />
    </WorkPlaceShell>
  );
}
