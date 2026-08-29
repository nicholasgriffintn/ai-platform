import { useParams } from "react-router";

import { ProjectTaskBoard } from "~/components/Work/ProjectTaskBoard";

export function meta() {
  return [{ title: "Tasks - Polychat" }];
}

export default function ProjectTasksPage() {
  const { workspaceId = "", projectId = "" } = useParams();

  return <ProjectTaskBoard workspaceId={workspaceId} projectId={projectId} />;
}
