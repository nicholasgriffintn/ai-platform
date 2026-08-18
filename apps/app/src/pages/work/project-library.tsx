import { useParams } from "react-router";

import { ProjectCapabilityLibrary } from "~/components/Work/ProjectCapabilityLibrary";

export function meta() {
  return [{ title: "Project capabilities - Polychat" }];
}

export default function ProjectLibraryPage() {
  const { workspaceId = "", projectId = "" } = useParams();

  return <ProjectCapabilityLibrary workspaceId={workspaceId} projectId={projectId} />;
}
