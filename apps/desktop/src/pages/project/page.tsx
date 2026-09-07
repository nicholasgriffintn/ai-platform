import { ProjectHome } from "@ngriffin_uk/polychat-component-shell";
import { useParams } from "react-router";

export default function DesktopProjectPage() {
  const { workspaceId = "", projectId = "" } = useParams();

  return <ProjectHome workspaceId={workspaceId} projectId={projectId} />;
}
