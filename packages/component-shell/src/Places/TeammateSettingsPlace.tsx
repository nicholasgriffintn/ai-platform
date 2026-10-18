import { useParams } from "react-router";

import { TeammateEditorPage } from "../Teammates/TeammateEditorPage.js";
import { getPlaceScopePaths, usePlaceScope } from "./place-scope.js";

export function TeammateSettingsPlace() {
  const scope = usePlaceScope();
  const { teammateId = "" } = useParams();
  const { teammates } = getPlaceScopePaths(scope);

  return (
    <TeammateEditorPage
      teammateId={teammateId}
      teammatesPath={teammates}
      backPath={teammates}
      backLabel="Back to teammates"
      {...(scope.kind === "project"
        ? { projectId: scope.projectId, workspaceId: scope.workspaceId }
        : {})}
    />
  );
}
