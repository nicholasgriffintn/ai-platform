import { ProjectCapabilityLibrary } from "@ngriffin_uk/polychat-component-shell";
import { useParams } from "react-router";

export default function DesktopProjectTeammatesPage() {
  const { workspaceId = "", projectId = "" } = useParams();

  return <ProjectCapabilityLibrary workspaceId={workspaceId} projectId={projectId} />;
}
