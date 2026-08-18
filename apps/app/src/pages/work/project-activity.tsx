import { useParams } from "react-router";

import { ProjectActivity } from "~/components/Work/ProjectActivity";

export default function ProjectActivityPage() {
  const { projectId } = useParams<{ projectId: string }>();

  return projectId ? <ProjectActivity projectId={projectId} /> : null;
}
