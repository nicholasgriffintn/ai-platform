import { WorkspaceOverview } from "@ngriffin_uk/polychat-component-shell";
import { useParams } from "react-router";

export function meta() {
  return [{ title: "Workspace - Polychat" }];
}

export default function WorkspacePage() {
  const { workspaceId = "" } = useParams();

  return <WorkspaceOverview workspaceId={workspaceId} />;
}
