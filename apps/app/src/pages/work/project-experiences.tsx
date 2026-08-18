import { useParams } from "react-router";

import { ProjectExperiences } from "~/components/Work/ProjectExperiences";

export function meta() {
  return [{ title: "Project experiences - Polychat" }];
}

export default function ProjectExperiencesPage() {
  const { workspaceId = "", projectId = "" } = useParams();

  return <ProjectExperiences workspaceId={workspaceId} projectId={projectId} />;
}
