import { ProjectCapabilityLibrary, WorkPlaceShell } from "@ngriffin_uk/polychat-component-shell";
import { useParams } from "react-router";

export default function DesktopProjectTeammatesPage() {
  const { workspaceId = "", projectId = "" } = useParams();

  return (
    <WorkPlaceShell>
      <ProjectCapabilityLibrary workspaceId={workspaceId} projectId={projectId} />
    </WorkPlaceShell>
  );
}
