import { WorkInitiativesPage } from "@ngriffin_uk/polychat-component-shell";
import { useParams } from "react-router";

export function meta() {
  return [{ title: "Initiatives - Polychat" }];
}

export default function InitiativesRoute() {
  const { workspaceId = "" } = useParams();

  return <WorkInitiativesPage workspaceId={workspaceId} />;
}
