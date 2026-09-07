import { ProjectTaskDetail } from "@ngriffin_uk/polychat-component-shell";
import { useParams } from "react-router";

export default function DesktopProjectTaskPage() {
  const { workspaceId = "", projectId = "", taskId = "" } = useParams();

  return <ProjectTaskDetail workspaceId={workspaceId} projectId={projectId} taskId={taskId} />;
}
