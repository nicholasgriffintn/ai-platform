import { ProjectTaskBoard, WorkPlaceShell } from "@ngriffin_uk/polychat-component-shell";
import { useParams } from "react-router";

export default function DesktopProjectTasksPage() {
  const { workspaceId = "", projectId = "" } = useParams();

  return (
    <WorkPlaceShell>
      <ProjectTaskBoard workspaceId={workspaceId} projectId={projectId} />
    </WorkPlaceShell>
  );
}
