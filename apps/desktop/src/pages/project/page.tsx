import { ProjectHome, WorkPlaceShell } from "@ngriffin_uk/polychat-component-shell";
import { useParams } from "react-router";

export default function DesktopProjectPage() {
  const { workspaceId = "", projectId = "" } = useParams();

  return (
    <WorkPlaceShell>
      <ProjectHome workspaceId={workspaceId} projectId={projectId} />
    </WorkPlaceShell>
  );
}
