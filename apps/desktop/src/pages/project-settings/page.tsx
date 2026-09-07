import { ProjectSettings, WorkPlaceShell } from "@ngriffin_uk/polychat-component-shell";
import { useParams } from "react-router";

export default function DesktopProjectSettingsPage() {
  const { workspaceId = "", projectId = "" } = useParams();

  return (
    <WorkPlaceShell>
      <ProjectSettings workspaceId={workspaceId} projectId={projectId} />
    </WorkPlaceShell>
  );
}
