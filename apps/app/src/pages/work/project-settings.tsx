import { useParams } from "react-router";

import { ProjectSettings } from "~/components/Work/ProjectSettings";

export function meta() {
  return [{ title: "Project settings - Polychat" }];
}

export default function ProjectSettingsPage() {
  const { workspaceId = "", projectId = "" } = useParams();

  return <ProjectSettings workspaceId={workspaceId} projectId={projectId} />;
}
