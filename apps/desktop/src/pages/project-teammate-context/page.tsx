import { TeammateWorkingContextPage } from "@ngriffin_uk/polychat-component-shell";
import { getProjectBasePath } from "@ngriffin_uk/polychat-library-react";
import { useParams } from "react-router";

export default function DesktopProjectTeammateContextPage() {
  const { workspaceId = "", projectId = "", teammateId = "" } = useParams();
  const teammatesPath = `${getProjectBasePath(workspaceId, projectId)}/teammates`;

  return (
    <TeammateWorkingContextPage
      teammateId={teammateId}
      teammatesPath={teammatesPath}
      backPath={teammatesPath}
      backLabel="Back to teammates"
      projectId={projectId}
    />
  );
}
