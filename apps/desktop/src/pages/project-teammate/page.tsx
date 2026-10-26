import { Navigate, useParams } from "react-router";

export default function DesktopProjectTeammateRedirect() {
  const { workspaceId = "", teammateId = "" } = useParams();

  return <Navigate to={`/work/${workspaceId}/team/${teammateId}`} replace />;
}
