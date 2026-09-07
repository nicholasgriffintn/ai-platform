import { ToolRunner, WorkPlaceShell } from "@ngriffin_uk/polychat-component-shell";
import { getProjectBasePath } from "@ngriffin_uk/polychat-library-react";
import { useParams } from "react-router";

export default function DesktopProjectToolPage() {
  const { workspaceId = "", projectId = "", toolId = "" } = useParams();

  return (
    <WorkPlaceShell>
      <ToolRunner
        backPath={`${getProjectBasePath(workspaceId, projectId)}/teammates`}
        projectId={projectId}
        toolId={toolId}
      />
    </WorkPlaceShell>
  );
}
