import { useParams } from "react-router";

import { ProjectHome } from "~/components/Work/ProjectHome";

export function meta() {
  return [{ title: "Project - Polychat" }];
}

export default function ProjectPage() {
  const { workspaceId = "", projectId = "" } = useParams();

  return <ProjectHome workspaceId={workspaceId} projectId={projectId} />;
}
