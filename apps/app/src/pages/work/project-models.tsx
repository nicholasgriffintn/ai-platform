import { WorkspaceModels } from "@ngriffin_uk/polychat-component-shell";
import { useParams } from "react-router";

export function meta() {
  return [{ title: "Models - Polychat" }];
}

export default function ProjectModelsPage() {
  const { workspaceId = "", projectId = "" } = useParams();

  return <WorkspaceModels workspaceId={workspaceId} projectId={projectId} />;
}
