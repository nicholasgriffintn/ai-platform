import { useParams } from "react-router";

import { ProjectTaskDetail } from "~/components/Work/ProjectTaskDetail";

export function meta() {
  return [{ title: "Task - Polychat" }];
}

export default function ProjectTaskPage() {
  const { workspaceId = "", projectId = "", taskId = "" } = useParams();

  return <ProjectTaskDetail workspaceId={workspaceId} projectId={projectId} taskId={taskId} />;
}
