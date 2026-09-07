import { ProjectCapabilityLibrary } from "@ngriffin_uk/polychat-component-shell";
import { useParams } from "react-router";

export function meta() {
  return [{ title: "Project teammates - Polychat" }];
}

export default function ProjectTeammatesPage() {
  const { workspaceId = "", projectId = "" } = useParams();

  return <ProjectCapabilityLibrary workspaceId={workspaceId} projectId={projectId} />;
}
