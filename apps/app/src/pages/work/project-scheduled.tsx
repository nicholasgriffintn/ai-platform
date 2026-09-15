import { ProjectScheduledLibrary } from "@ngriffin_uk/polychat-component-shell";
import { useParams } from "react-router";

export function meta() {
  return [{ title: "Scheduled - Polychat" }];
}

export default function ProjectScheduledPage() {
  const { workspaceId = "", projectId = "" } = useParams();

  return <ProjectScheduledLibrary workspaceId={workspaceId} projectId={projectId} />;
}
