import { ProjectSettings } from "@ngriffin_uk/polychat-component-shell";
import { useParams } from "react-router";

export function meta() {
  return [{ title: "Project settings - Polychat" }];
}

export default function ProjectSettingsPage() {
  const { workspaceId = "", projectId = "" } = useParams();

  return <ProjectSettings workspaceId={workspaceId} projectId={projectId} />;
}
