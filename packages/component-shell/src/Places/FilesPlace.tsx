import { useParams } from "react-router";

import { FilesPage } from "../Files/FilesPage.js";
import { ProjectHomeHeader } from "../Work/ProjectHomeHeader.js";
import { getPlaceScopePaths, usePlaceScope } from "./place-scope.js";

export function FilesPlace() {
  const scope = usePlaceScope();
  const { "*": subpath = "" } = useParams();
  const basePath = getPlaceScopePaths(scope).files;

  if (scope.kind === "project") {
    return (
      <FilesPage
        basePath={basePath}
        projectId={scope.projectId}
        subpath={subpath}
        header={<ProjectHomeHeader workspaceId={scope.workspaceId} projectId={scope.projectId} />}
      />
    );
  }

  return <FilesPage basePath={basePath} subpath={subpath} />;
}
