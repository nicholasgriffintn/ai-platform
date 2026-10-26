import { WorkCostsPage } from "@ngriffin_uk/polychat-component-shell";
import { useParams } from "react-router";

export function meta() {
  return [{ title: "Costs - Polychat" }];
}

export default function CostsRoute() {
  const { workspaceId = "" } = useParams();

  return <WorkCostsPage workspaceId={workspaceId} />;
}
