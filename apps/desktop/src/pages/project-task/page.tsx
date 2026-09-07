import { ProjectTaskDetail, WorkPlaceShell } from "@ngriffin_uk/polychat-component-shell";
import { useParams } from "react-router";

export default function DesktopProjectTaskPage() {
  const { workspaceId = "", projectId = "", taskId = "" } = useParams();

  return (
    <WorkPlaceShell>
      <ProjectTaskDetail workspaceId={workspaceId} projectId={projectId} taskId={taskId} />
    </WorkPlaceShell>
  );
}
