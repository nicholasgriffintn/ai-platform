import { ProjectActivity } from "@ngriffin_uk/polychat-component-shell";
import { useParams } from "react-router";

export default function DesktopProjectActivityPage() {
  const { projectId = "" } = useParams();

  return <ProjectActivity projectId={projectId} />;
}
