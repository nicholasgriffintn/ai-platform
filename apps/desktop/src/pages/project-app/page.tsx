import { AppRoute, useWorkData, WorkPlaceShell } from "@ngriffin_uk/polychat-component-shell";
import { getProjectSurface } from "@ngriffin_uk/polychat-library-react";
import { useParams } from "react-router";

function ProjectApp() {
  const { workspaceId = "", projectId = "", appId = "", "*": subpath = "" } = useParams();
  const { projectQuery } = useWorkData();

  return (
    <AppRoute
      surface={getProjectSurface(workspaceId, projectId)}
      appId={appId}
      subpath={subpath}
      project={{
        name: projectQuery.data?.name,
        capabilities: projectQuery.data?.capabilities,
        isLoading: projectQuery.isLoading,
        error: projectQuery.error,
      }}
    />
  );
}

export default function DesktopProjectAppPage() {
  return (
    <WorkPlaceShell>
      <ProjectApp />
    </WorkPlaceShell>
  );
}
