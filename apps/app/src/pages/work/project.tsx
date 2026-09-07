import { ProjectHome } from "@ngriffin_uk/polychat-component-shell";
import { useParams } from "react-router";

export function meta() {
  return [{ title: "Project - Polychat" }];
}

export default function ProjectPage() {
  const { workspaceId = "", projectId = "" } = useParams();

  return <ProjectHome workspaceId={workspaceId} projectId={projectId} />;
}
