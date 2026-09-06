import { useParams } from "react-router";

import { TeammateEditorPage } from "~/components/Teammates/TeammateEditorPage";
import { PLACE_PATHS } from "~/lib/navigation/places";

export function meta() {
  return [{ title: "Configure a teammate - Polychat" }];
}

export default function PersonalTeammatePage() {
  const { teammateId = "" } = useParams();

  return (
    <TeammateEditorPage
      teammateId={teammateId}
      teammatesPath="/chat/agents"
      backPath={PLACE_PATHS.library}
      backLabel="Back to capabilities"
    />
  );
}
