import { ProjectPluginsPage } from "@ngriffin_uk/polychat-component-shell";
import { useParams } from "react-router";

export function meta() {
  return [{ title: "Plugins - Polychat" }];
}

export default function ProjectPluginsRoute() {
  const { workspaceId = "", projectId = "" } = useParams();

  return <ProjectPluginsPage workspaceId={workspaceId} projectId={projectId} />;
}
