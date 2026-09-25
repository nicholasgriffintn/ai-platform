import { WorkspaceModels } from "@ngriffin_uk/polychat-component-shell";
import { useParams } from "react-router";

export function meta() {
  return [{ title: "Models - Polychat" }];
}

export default function WorkspaceModelsPage() {
  const { workspaceId = "" } = useParams();

  return <WorkspaceModels workspaceId={workspaceId} />;
}
