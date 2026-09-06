import { Navigate, useParams } from "react-router";

import { getProjectFilesPath } from "~/lib/files-route";

export default function ProjectOutputsPage() {
  const { workspaceId = "", projectId = "", "*": subpath = "" } = useParams();

  return (
    <Navigate
      to={getProjectFilesPath(workspaceId, projectId, "made", subpath || undefined)}
      replace
    />
  );
}
