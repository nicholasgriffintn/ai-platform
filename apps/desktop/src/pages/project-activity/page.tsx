import { ProjectActivity } from "@ngriffin_uk/polychat-component-shell";
import { useParams } from "react-router";

export default function DesktopProjectActivityPage() {
  const { workspaceId = "", projectId = "" } = useParams();

  return <ProjectActivity workspaceId={workspaceId} projectId={projectId} />;
}
