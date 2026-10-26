import { WorkTeammatePage } from "@ngriffin_uk/polychat-component-shell";
import { useParams } from "react-router";

export default function DesktopTeammatePage() {
  const { workspaceId = "", teammateId = "" } = useParams();

  return <WorkTeammatePage workspaceId={workspaceId} teammateId={teammateId} />;
}
