import { WorkTeammatePage } from "@ngriffin_uk/polychat-component-shell";
import { useParams } from "react-router";

export function meta() {
  return [{ title: "Teammate - Polychat" }];
}

export default function TeammateRoute() {
  const { workspaceId = "", teammateId = "" } = useParams();

  return <WorkTeammatePage workspaceId={workspaceId} teammateId={teammateId} />;
}
