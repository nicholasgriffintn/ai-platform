import { WorkInitiativesPage } from "@ngriffin_uk/polychat-component-shell";
import { useParams } from "react-router";

export default function DesktopInitiativesPage() {
  const { workspaceId = "" } = useParams();

  return <WorkInitiativesPage workspaceId={workspaceId} />;
}
