import { useParams } from "react-router";

import { TeammateWorkingContextPage } from "../Teammates/TeammateWorkingContextPage.js";
import { getPlaceScopePaths, usePlaceScope } from "./place-scope.js";

export function TeammateContextPlace() {
  const scope = usePlaceScope();
  const { teammateId = "" } = useParams();
  const { teammates } = getPlaceScopePaths(scope);

  return (
    <TeammateWorkingContextPage
      teammateId={teammateId}
      teammatesPath={teammates}
      backPath={teammates}
      backLabel="Back to teammates"
      {...(scope.kind === "project" ? { projectId: scope.projectId } : {})}
    />
  );
}
