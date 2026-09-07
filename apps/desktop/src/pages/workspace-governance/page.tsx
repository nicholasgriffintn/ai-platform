import { WorkspaceGovernance } from "@ngriffin_uk/polychat-component-shell";
import { useParams } from "react-router";

export default function DesktopWorkspaceGovernancePage() {
  const { workspaceId = "" } = useParams();

  return <WorkspaceGovernance workspaceId={workspaceId} />;
}
