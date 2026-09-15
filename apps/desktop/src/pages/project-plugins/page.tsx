import { ProjectPluginsPage } from "@ngriffin_uk/polychat-component-shell";
import { useParams } from "react-router";

export default function DesktopProjectPluginsPage() {
  const { workspaceId = "", projectId = "" } = useParams();

  return <ProjectPluginsPage workspaceId={workspaceId} projectId={projectId} />;
}
