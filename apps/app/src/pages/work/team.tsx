import { WorkTeamPage } from "@ngriffin_uk/polychat-component-shell";
import { useParams } from "react-router";

export function meta() {
  return [{ title: "Team - Polychat" }];
}

export default function TeamRoute() {
  const { workspaceId = "" } = useParams();

  return <WorkTeamPage workspaceId={workspaceId} />;
}
