import { ConfirmationDialog, SegmentedControl } from "@ngriffin_uk/polychat-component-ui";
import {
  inboxEntriesFor,
  WorkInbox,
  workPlaceNamesFrom,
  WorkspaceOverviewActions,
  WorkspaceOverviewSkeleton,
  WorkspaceProjectsSection,
} from "@ngriffin_uk/polychat-component-workspaces";
import {
  canManageWorkspace,
  getProjectBasePath,
  useDecideInboxHire,
  useDeleteWorkspace,
  useTaskAttention,
  useWorkInbox,
} from "@ngriffin_uk/polychat-library-react";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import { PageShell } from "../Shell/PageShell.js";
import { CreateProjectDialog } from "./CreateProjectDialog.js";
import { InviteMemberDialog } from "./InviteMemberDialog.js";
import { useViewParam } from "./useViewParam.js";
import { useWorkData } from "./WorkDataContext.js";
import { WorkPageFailure } from "./WorkPageFailure.js";

type WorkspaceView = "auto" | "needs" | "projects";

function readWorkspaceView(value: string | null): WorkspaceView {
  return value === "needs" || value === "projects" ? value : "auto";
}

export function WorkspaceOverview({ workspaceId }: { workspaceId: string }) {
  const { workspaceQuery } = useWorkData();
  const tasks = useTaskAttention();
  const inbox = useWorkInbox();
  const decideHire = useDecideInboxHire();
  const [requestedView, setView] = useViewParam<WorkspaceView>(readWorkspaceView, "auto");
  const { data: workspace, isLoading, error } = workspaceQuery;
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const deleteWorkspace = useDeleteWorkspace();
  const navigate = useNavigate();

  if (isLoading) {
    return <WorkspaceOverviewSkeleton />;
  }

  if (error || !workspace) {
    return (
      <WorkPageFailure
        title="Workspace"
        error={error}
        fallbackMessage="Workspace not found"
        signInTitle="Sign in to view this workspace"
        signInMessage="Sign in to access this workspace and its projects."
      />
    );
  }

  const decisions = (inbox.data?.data ?? []).filter((item) => item.workspaceId === workspaceId);
  const taskItems = tasks.items.filter((item) => item.workspaceId === workspaceId);
  const needsYouCount = inboxEntriesFor("needs", decisions, taskItems).length;
  const view =
    requestedView === "auto" ? (needsYouCount > 0 ? "needs" : "projects") : requestedView;
  const canManage = canManageWorkspace(workspace);
  const updateReceipt = async (id: string, action: "read" | "dismiss") => {
    try {
      await (action === "read" ? tasks.markRead([id]) : tasks.dismiss([id]));
    } catch (receiptError) {
      toast.error(getErrorMessage(receiptError, "Unable to update this notification."));
    }
  };

  return (
    <>
      <PageShell.Content className="max-w-6xl">
        <PageShell.Header
          title={workspace.name}
          actionContent={
            canManage ? (
              <WorkspaceOverviewActions
                isOwner={workspace.role === "owner"}
                onCreateProject={() => setIsCreateOpen(true)}
                onDeleteWorkspace={() => setIsDeleteOpen(true)}
                onInvite={() => setIsInviteOpen(true)}
              />
            ) : undefined
          }
        />
        <p className="mb-6 max-w-2xl text-sm text-muted-foreground">
          {workspace.description || `Your role: ${workspace.role}`}
        </p>

        <div className="space-y-6">
          <SegmentedControl
            label="Workspace views"
            value={view}
            options={[
              { id: "needs", label: "Needs you", count: needsYouCount },
              { id: "projects", label: "Projects", count: workspace.projects.length },
            ]}
            onChange={setView}
          />
          {view === "needs" ? (
            <WorkInbox
              view="needs"
              decisions={decisions}
              tasks={taskItems}
              names={workPlaceNamesFrom(inbox.data?.places ?? [])}
              personalFirst={false}
              showWorkspaceHeadings={false}
              projectHref={getProjectBasePath}
              isLoading={tasks.isLoading || inbox.isLoading}
              canDecideHire={() => canManage}
              isBusy={decideHire.isPending}
              onDecideHire={(item, decision) => {
                if (item.teammateId && item.workspaceId) {
                  void decideHire.mutateAsync({
                    workspaceId: item.workspaceId,
                    teammateId: item.teammateId,
                    decision,
                  });
                }
              }}
              onRead={(item) => void updateReceipt(item.id, "read")}
              onDismiss={(item) => void updateReceipt(item.id, "dismiss")}
            />
          ) : (
            <WorkspaceProjectsSection
              projects={workspace.projects.map((project) => ({
                ...project,
                href: `/work/${workspaceId}/projects/${project.id}`,
              }))}
              canManage={canManage}
              onCreateProject={() => setIsCreateOpen(true)}
            />
          )}
        </div>
      </PageShell.Content>
      <CreateProjectDialog
        workspaceId={workspaceId}
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
      />
      <InviteMemberDialog
        workspaceId={workspaceId}
        canInviteAdmin={workspace.role === "owner"}
        open={isInviteOpen}
        onOpenChange={setIsInviteOpen}
      />
      <ConfirmationDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        title="Delete workspace"
        description={`Delete ${workspace.name} and all of its projects, conversations, and invitations. This cannot be undone.`}
        confirmText="Delete workspace"
        variant="destructive"
        isLoading={deleteWorkspace.isPending}
        onConfirm={async () => {
          await deleteWorkspace.mutateAsync(workspaceId);
          void navigate("/work", { replace: true });
        }}
      >
        {deleteWorkspace.error && (
          <p role="alert" className="text-sm text-failure">
            {deleteWorkspace.error.message}
          </p>
        )}
      </ConfirmationDialog>
    </>
  );
}
