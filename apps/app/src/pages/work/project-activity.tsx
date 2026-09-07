import { ProjectActivity } from "@ngriffin_uk/polychat-component-shell";
import { useParams } from "react-router";

export default function ProjectActivityPage() {
  const { projectId } = useParams<{ projectId: string }>();

  return projectId ? <ProjectActivity projectId={projectId} /> : null;
}
