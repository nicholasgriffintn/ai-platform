import { useParams } from "react-router";

import { ProjectCapabilityLibrary } from "~/components/Work/ProjectCapabilityLibrary";

export function meta() {
  return [{ title: "Project teammates - Polychat" }];
}

export default function ProjectTeammatesPage() {
  const { workspaceId = "", projectId = "" } = useParams();

  return <ProjectCapabilityLibrary workspaceId={workspaceId} projectId={projectId} />;
}
