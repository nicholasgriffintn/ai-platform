import { ProjectTaskBoard } from "@ngriffin_uk/polychat-component-shell";
import { useParams } from "react-router";

export function meta() {
  return [{ title: "Project - Polychat" }];
}

export default function ProjectPage() {
  const { workspaceId = "", projectId = "" } = useParams();

  return <ProjectTaskBoard workspaceId={workspaceId} projectId={projectId} />;
}
