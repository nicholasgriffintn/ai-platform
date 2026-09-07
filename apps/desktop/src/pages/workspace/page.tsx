import { WorkspaceOverview } from "@ngriffin_uk/polychat-component-shell";
import { useParams } from "react-router";

export default function DesktopWorkspacePage() {
  const { workspaceId = "" } = useParams();

  return <WorkspaceOverview workspaceId={workspaceId} />;
}
