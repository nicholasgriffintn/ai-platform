import { ProjectSettings } from "@ngriffin_uk/polychat-component-shell";
import { useParams } from "react-router";

export default function DesktopProjectSettingsPage() {
  const { workspaceId = "", projectId = "" } = useParams();

  return <ProjectSettings workspaceId={workspaceId} projectId={projectId} />;
}
