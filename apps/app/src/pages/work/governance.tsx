import { WorkspaceGovernance } from "@ngriffin_uk/polychat-component-shell";
import { useParams } from "react-router";

export default function WorkspaceGovernancePage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();

  return workspaceId ? <WorkspaceGovernance workspaceId={workspaceId} /> : null;
}
