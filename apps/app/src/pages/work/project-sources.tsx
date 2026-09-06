import { Navigate, useParams } from "react-router";

import { getProjectFilesPath } from "~/lib/files-route";

export default function ProjectSourcesPage() {
  const { workspaceId = "", projectId = "" } = useParams();

  return <Navigate to={getProjectFilesPath(workspaceId, projectId, "given")} replace />;
}
