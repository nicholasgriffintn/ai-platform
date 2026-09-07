import { ProjectTaskBoard } from "@ngriffin_uk/polychat-component-shell";
import { useParams } from "react-router";

export default function DesktopProjectTasksPage() {
  const { workspaceId = "", projectId = "" } = useParams();

  return <ProjectTaskBoard workspaceId={workspaceId} projectId={projectId} />;
}
