import { TeammateEditorPage } from "@ngriffin_uk/polychat-component-shell";
import { getProjectBasePath } from "@ngriffin_uk/polychat-library-react";
import { useParams } from "react-router";

export default function DesktopProjectTeammatePage() {
  const { workspaceId = "", projectId = "", teammateId = "" } = useParams();
  const teammatesPath = `${getProjectBasePath(workspaceId, projectId)}/teammates`;

  return (
    <TeammateEditorPage
      teammateId={teammateId}
      teammatesPath={teammatesPath}
      backPath={teammatesPath}
      backLabel="Back to capabilities"
      projectId={projectId}
    />
  );
}
