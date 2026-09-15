import { TeammateWorkingContextPage } from "@ngriffin_uk/polychat-component-shell";
import { getPlacePaths } from "@ngriffin_uk/polychat-library-react";
import { useParams } from "react-router";

export default function DesktopTeammateContextPage() {
  const { teammateId = "" } = useParams();
  const teammatesPath = getPlacePaths("chat").teammates;

  return (
    <TeammateWorkingContextPage
      teammateId={teammateId}
      teammatesPath={teammatesPath}
      backPath={teammatesPath}
      backLabel="Back to teammates"
    />
  );
}
