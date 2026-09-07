import { TeammateEditorPage } from "@ngriffin_uk/polychat-component-shell";
import { getPlacePaths } from "@ngriffin_uk/polychat-library-react";
import { useParams } from "react-router";

export default function DesktopTeammatePage() {
  const { teammateId = "" } = useParams();
  const teammates = getPlacePaths("chat").teammates;

  return (
    <TeammateEditorPage
      teammateId={teammateId}
      teammatesPath={teammates}
      backPath={teammates}
      backLabel="Back to teammates"
    />
  );
}
