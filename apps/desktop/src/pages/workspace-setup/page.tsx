import { WorkSetupPage } from "@ngriffin_uk/polychat-component-shell";
import { useParams } from "react-router";

export default function DesktopSetupPage() {
  const { workspaceId = "" } = useParams();

  return <WorkSetupPage workspaceId={workspaceId} />;
}
