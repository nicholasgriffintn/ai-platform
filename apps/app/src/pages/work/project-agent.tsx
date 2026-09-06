import { Navigate, useParams } from "react-router";

export default function LegacyProjectTeammatePage() {
  const { workspaceId, projectId, teammateId } = useParams();

  return (
    <Navigate
      to={`/work/${workspaceId}/projects/${projectId}/teammates/${teammateId ?? "new"}`}
      replace
    />
  );
}
