import { Outlet, useLocation, useParams } from "react-router";

import { ConversationProductHeader } from "~/components/ConversationThread/ConversationProductHeader";
import { PageShell } from "~/components/Core/PageShell";
import { WorkAccessGate } from "~/components/Work/WorkAccessGate";
import { useWorkData } from "~/components/Work/WorkDataContext";
import { WorkDataProvider } from "~/components/Work/WorkDataProvider";
import { WorkSidebar } from "~/components/Work/WorkSidebar";
import { isProjectConversationPath } from "~/lib/conversation-route";

function WorkShell({ projectId, workspaceId }: { projectId?: string; workspaceId?: string }) {
  const { pathname } = useLocation();
  const { projectQuery } = useWorkData();
  const projectColour = projectQuery.data?.colour;
  const isProjectConversation = Boolean(projectId) && isProjectConversationPath(pathname);

  return (
    <PageShell
      title={isProjectConversation ? undefined : "Work"}
      headerContent={
        isProjectConversation ? (
          <ConversationProductHeader projectColour={projectColour} />
        ) : undefined
      }
      sidebarContent={<WorkSidebar workspaceId={workspaceId} projectId={projectId} />}
      fullBleed
      displayNavBar={false}
      projectColour={projectId ? projectColour : undefined}
    >
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <div data-header-scroll-source className="min-h-0 flex-1 overflow-y-auto">
          <WorkAccessGate requiresAuthentication={Boolean(workspaceId || projectId)}>
            <Outlet />
          </WorkAccessGate>
        </div>
      </div>
    </PageShell>
  );
}

export default function WorkLayout() {
  const { projectId, workspaceId } = useParams();

  return (
    <WorkDataProvider projectId={projectId} workspaceId={workspaceId}>
      <WorkShell projectId={projectId} workspaceId={workspaceId} />
    </WorkDataProvider>
  );
}
