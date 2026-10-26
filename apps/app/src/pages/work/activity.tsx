import { WorkActivityPage } from "@ngriffin_uk/polychat-component-shell";
import { useParams } from "react-router";

export function meta() {
  return [{ title: "Activity - Polychat" }];
}

export default function ActivityRoute() {
  const { workspaceId = "" } = useParams();

  return <WorkActivityPage workspaceId={workspaceId} />;
}
