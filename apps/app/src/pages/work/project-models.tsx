import { isModelPlace, WorkspaceModels } from "@ngriffin_uk/polychat-component-shell";
import { useParams } from "react-router";

export function meta() {
  return [{ title: "Models - Polychat" }];
}

export default function ProjectModelsPage() {
  const { workspaceId = "", projectId = "", place } = useParams();

  return (
    <WorkspaceModels
      workspaceId={workspaceId}
      projectId={projectId}
      place={isModelPlace(place) ? place : "overview"}
    />
  );
}
