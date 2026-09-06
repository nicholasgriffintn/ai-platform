import { Navigate, useParams } from "react-router";

export default function LegacyPersonalTeammatePage() {
  const { teammateId } = useParams();

  return <Navigate to={`/chat/teammates/${teammateId ?? "new"}`} replace />;
}
