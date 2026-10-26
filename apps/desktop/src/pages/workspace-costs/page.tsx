import { WorkCostsPage } from "@ngriffin_uk/polychat-component-shell";
import { useParams } from "react-router";

export default function DesktopCostsPage() {
  const { workspaceId = "" } = useParams();

  return <WorkCostsPage workspaceId={workspaceId} />;
}
