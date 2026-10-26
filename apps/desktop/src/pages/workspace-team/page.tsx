import { WorkTeamPage } from "@ngriffin_uk/polychat-component-shell";
import { useParams } from "react-router";

export default function DesktopTeamPage() {
  const { workspaceId = "" } = useParams();

  return <WorkTeamPage workspaceId={workspaceId} />;
}
