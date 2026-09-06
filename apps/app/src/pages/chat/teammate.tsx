import { useParams } from "react-router";

import { TeammateEditorPage } from "~/components/Teammates/TeammateEditorPage";
import { getPlacePaths } from "~/lib/navigation/places";

export function meta() {
  return [{ title: "Configure a teammate - Polychat" }];
}

export default function PersonalTeammatePage() {
  const { teammateId = "" } = useParams();

  return (
    <TeammateEditorPage
      teammateId={teammateId}
      teammatesPath="/chat/teammates"
      backPath={getPlacePaths("chat").teammates}
      backLabel="Back to capabilities"
    />
  );
}
