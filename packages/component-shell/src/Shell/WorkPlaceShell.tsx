import { isProjectConversationPath } from "@ngriffin_uk/polychat-library-react";
import type { ReactNode } from "react";
import { useLocation, useParams } from "react-router";

import { WorkAccessGate } from "../Work/WorkAccessGate.js";
import { useWorkData } from "../Work/WorkDataContext.js";
import { WorkDataProvider } from "../Work/WorkDataProvider.js";
import { WorkSidebar } from "../Work/WorkSidebar.js";
import { PageShell } from "./PageShell.js";

interface WorkShellProps {
  children: ReactNode;
  projectId?: string;
  workspaceId?: string;
}

function WorkShell({ children, projectId, workspaceId }: WorkShellProps) {
  const { pathname } = useLocation();
  const { projectQuery } = useWorkData();
  const projectColour = projectQuery.data?.colour;
  const isProjectConversation = Boolean(projectId) && isProjectConversationPath(pathname);

  return (
    <PageShell
      title={isProjectConversation ? undefined : "Work"}
      sidebarContent={<WorkSidebar workspaceId={workspaceId} projectId={projectId} />}
      fullBleed
      displayNavBar={false}
      projectColour={projectId ? projectColour : undefined}
    >
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <div data-header-scroll-source className="min-h-0 flex-1 overflow-y-auto">
          <WorkAccessGate requiresAuthentication={Boolean(workspaceId || projectId)}>
            {children}
          </WorkAccessGate>
        </div>
      </div>
    </PageShell>
  );
}

export function WorkPlaceShell({ children }: { children: ReactNode }) {
  const { projectId, workspaceId } = useParams();

  return (
    <WorkDataProvider projectId={projectId} workspaceId={workspaceId}>
      <WorkShell projectId={projectId} workspaceId={workspaceId}>
        {children}
      </WorkShell>
    </WorkDataProvider>
  );
}
