import { Outlet, useParams } from "react-router";

import { WorkDataProvider } from "~/components/Work/WorkDataProvider";
import { WorkPageShell } from "~/components/Work/WorkPageShell";

export default function WorkLayout() {
  const { projectId, workspaceId } = useParams();

  return (
    <WorkDataProvider projectId={projectId} workspaceId={workspaceId}>
      <WorkPageShell projectId={projectId} workspaceId={workspaceId}>
        <Outlet />
      </WorkPageShell>
    </WorkDataProvider>
  );
}
