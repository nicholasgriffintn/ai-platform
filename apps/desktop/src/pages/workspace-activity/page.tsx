import { WorkActivityPage } from "@ngriffin_uk/polychat-component-shell";
import { useParams } from "react-router";

export default function DesktopActivityPage() {
  const { workspaceId = "" } = useParams();

  return <WorkActivityPage workspaceId={workspaceId} />;
}
