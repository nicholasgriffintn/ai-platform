import { WorkSetupPage } from "@ngriffin_uk/polychat-component-shell";
import { useParams } from "react-router";

export function meta() {
  return [{ title: "Setup - Polychat" }];
}

export default function SetupRoute() {
  const { workspaceId = "" } = useParams();

  return <WorkSetupPage workspaceId={workspaceId} />;
}
