import { ProjectTaskDetail } from "@ngriffin_uk/polychat-component-shell";
import { useParams } from "react-router";

export function meta() {
  return [{ title: "Task - Polychat" }];
}

export default function ProjectTaskPage() {
  const { workspaceId = "", projectId = "", taskId = "" } = useParams();

  return <ProjectTaskDetail workspaceId={workspaceId} projectId={projectId} taskId={taskId} />;
}
