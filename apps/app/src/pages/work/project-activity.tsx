import { ProjectActivity } from "@ngriffin_uk/polychat-component-shell";
import { useParams } from "react-router";

export default function ProjectActivityPage() {
  const { workspaceId, projectId } = useParams<{ workspaceId: string; projectId: string }>();

  return workspaceId && projectId ? (
    <ProjectActivity workspaceId={workspaceId} projectId={projectId} />
  ) : null;
}
