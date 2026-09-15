import { ProjectScheduledLibrary } from "@ngriffin_uk/polychat-component-shell";
import { useParams } from "react-router";

export default function DesktopProjectScheduledPage() {
  const { workspaceId = "", projectId = "" } = useParams();

  return <ProjectScheduledLibrary workspaceId={workspaceId} projectId={projectId} />;
}
