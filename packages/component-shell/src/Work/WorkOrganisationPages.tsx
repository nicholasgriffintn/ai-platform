import { BackLink, cn, EmptyState, Link } from "@ngriffin_uk/polychat-component-ui";
import {
  InitiativeDialog,
  InitiativesView,
  SetupPlanView,
  WorkspaceAuditList,
  WorkTaskList,
} from "@ngriffin_uk/polychat-component-workspaces";
import {
  useInitiativeActions,
  useInitiatives,
  useMyTasks,
  useRecipeConnectors,
  useSetupActions,
  useUpdateWorkspaceOrganisation,
  useWorkCosts,
  useWorkspace,
  useWorkspaceAudit,
  useWorkspaceSetup,
} from "@ngriffin_uk/polychat-library-react";
import {
  creditsFromCreditMicros,
  WORK_BUDGET_WARNING_RATIO,
  type ProjectTask,
} from "@ngriffin_uk/polychat-schemas";
import { formatCredits, getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import { ListTodo, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageShell } from "../Shell/PageShell.js";
import { useWorkDirectory } from "./useWorkDirectory.js";
import { WorkspaceUsage } from "./WorkspaceUsage.js";

export function WorkInitiativesPage({ workspaceId }: { workspaceId: string }) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const workspace = useWorkspace(workspaceId);
  const initiatives = useInitiatives(workspaceId);
  const actions = useInitiativeActions(workspaceId);
  const organisation = useUpdateWorkspaceOrganisation(workspaceId);
  const canManage = workspace.data?.role === "owner" || workspace.data?.role === "admin";
  const projects = (workspace.data?.projects ?? []).map((project) => ({
    id: project.id,
    name: project.name,
    href: `/work/${workspaceId}/projects/${project.id}`,
  }));

  return (
    <PageShell.Content className="max-w-5xl">
      <PageShell.Header
        title="Initiatives"
        actions={
          canManage
            ? [
                {
                  label: "New initiative",
                  icon: <Plus size={17} />,
                  onClick: () => setIsCreateOpen(true),
                },
              ]
            : undefined
        }
      />
      {initiatives.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : initiatives.error ? (
        <p role="alert" className="text-sm text-failure">
          {getErrorMessage(initiatives.error, "Initiatives could not be loaded")}
        </p>
      ) : (
        <InitiativesView
          mission={initiatives.data?.mission ?? ""}
          initiatives={initiatives.data?.initiatives ?? []}
          projects={projects}
          unalignedProjectIds={initiatives.data?.unalignedProjectIds ?? []}
          canManage={canManage}
          isSaving={organisation.isPending || actions.create.isPending || actions.update.isPending}
          onSaveMission={(mission) =>
            void organisation
              .mutateAsync({ mission })
              .then(() => toast.success("Mission saved"))
              .catch((error: unknown) => toast.error(getErrorMessage(error, "Could not save")))
          }
          onToggleProject={(initiative, projectId) =>
            void actions.update.mutateAsync({
              initiativeId: initiative.id,
              changes: {
                projectIds: initiative.projectIds.includes(projectId)
                  ? initiative.projectIds.filter((id) => id !== projectId)
                  : [...initiative.projectIds, projectId],
              },
            })
          }
          onComplete={(initiative) =>
            void actions.update.mutateAsync({
              initiativeId: initiative.id,
              changes: { status: "completed" },
            })
          }
        />
      )}
      <InitiativeDialog
        open={isCreateOpen}
        projects={projects}
        isSaving={actions.create.isPending}
        onOpenChange={setIsCreateOpen}
        onSubmit={(input) => actions.create.mutateAsync(input)}
      />
    </PageShell.Content>
  );
}

export function WorkCostsPage({ workspaceId }: { workspaceId: string }) {
  const workspace = useWorkspace(workspaceId);
  const costs = useWorkCosts(workspaceId);
  const cap = workspace.data?.monthlyCreditCapMicros ?? null;
  const spent = costs.data?.totalCreditMicros ?? 0;
  const ratio = cap ? Math.min(1, spent / cap) : 0;

  return (
    <PageShell.Content className="max-w-5xl">
      <PageShell.Header title="Costs" />
      {cap ? (
        <div className="mb-8 space-y-2 rounded-xl border border-border bg-surface p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
            <span className="font-medium">Team budget this month</span>
            <span className="text-muted-foreground tabular-nums">
              {formatCredits(creditsFromCreditMicros(spent))} of{" "}
              {formatCredits(creditsFromCreditMicros(cap))} credits
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-selection">
            <div
              className={cn(
                "h-full rounded-full",
                ratio >= 1
                  ? "bg-failure"
                  : ratio >= WORK_BUDGET_WARNING_RATIO
                    ? "bg-attention"
                    : "bg-success",
              )}
              style={{ width: `${ratio * 100}%` }}
            />
          </div>
        </div>
      ) : null}
      <WorkspaceUsage workspaceId={workspaceId} projects={workspace.data?.projects ?? []} />
    </PageShell.Content>
  );
}

export function WorkActivityPage({ workspaceId }: { workspaceId: string }) {
  const audit = useWorkspaceAudit(workspaceId);

  return (
    <PageShell.Content className="max-w-5xl">
      <PageShell.Header title="Activity" />
      <p className="mb-6 text-sm text-muted-foreground">
        Everything people and teammates did in this workspace, newest first. Records are
        append-only.
      </p>
      <WorkspaceAuditList
        records={audit.data ?? []}
        isLoading={audit.isLoading}
        errorMessage={audit.error?.message}
      />
    </PageShell.Content>
  );
}

export function WorkSetupPage({ workspaceId }: { workspaceId: string }) {
  const setup = useWorkspaceSetup(workspaceId);
  const workspace = useWorkspace(workspaceId);
  const actions = useSetupActions(workspaceId);
  const connectors = useRecipeConnectors();
  const canManage = workspace.data?.role === "owner" || workspace.data?.role === "admin";
  const state = setup.data;

  return (
    <PageShell.Content className="max-w-5xl">
      <BackLink href={`/work/${workspaceId}/team`} label="Back to the team" />
      <PageShell.Header title="Set up the workspace" />
      {setup.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading the setup plan…</p>
      ) : !state ? (
        <p role="alert" className="text-sm text-failure">
          {setup.error
            ? getErrorMessage(setup.error, "")
            : "This workspace has no setup in progress."}
        </p>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            The lead owns the setup task.{" "}
            <Link
              className="underline"
              href={`/work/${workspaceId}/projects/${state.projectId}/tasks/${state.setupTaskId}`}
            >
              Open it
            </Link>{" "}
            to follow its work or ask for changes.
          </p>
          <SetupPlanView
            setup={state.setup}
            canApprove={canManage}
            connectorName={(provider) =>
              connectors.data?.connectors.find((connector) => connector.id === provider)?.name ??
              provider
            }
            connectHref="/chat/plugins"
            isBusy={actions.approve.isPending || actions.archive.isPending}
            onApprove={(revision) =>
              void actions.approve
                .mutateAsync(revision)
                .then(() => toast.success("Approved. The team is starting."))
                .catch((error: unknown) =>
                  toast.error(getErrorMessage(error, "The plan could not be applied")),
                )
            }
            onArchive={() =>
              void actions.archive
                .mutateAsync()
                .then(() => toast.success("Archived what the plan created"))
            }
          />
        </div>
      )}
    </PageShell.Content>
  );
}

function MyWorkspaceTasks({ workspaceId, tasks }: { workspaceId: string; tasks: ProjectTask[] }) {
  const { directory, workspaceQuery } = useWorkDirectory(workspaceId);

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold">{workspaceQuery.data?.name ?? "Workspace"}</h2>
      <WorkTaskList
        tasks={tasks}
        directory={directory}
        taskHref={(task) => `/work/${task.workspaceId}/projects/${task.projectId}/tasks/${task.id}`}
      />
    </section>
  );
}

export function WorkMyTasksPage() {
  const tasks = useMyTasks();
  const all = tasks.data?.tasks ?? [];
  const workspaceIds = [...new Set(all.map((task) => task.workspaceId))];

  return (
    <PageShell.Content className="max-w-6xl space-y-6">
      <PageShell.Header title="My tasks" />
      {tasks.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : workspaceIds.length === 0 ? (
        <EmptyState
          icon={<ListTodo size={24} className="text-muted-foreground" />}
          title="Nothing on your plate"
          message="Tasks you own, and tasks your teammates run on your behalf, show up here."
          className="min-h-[220px]"
        />
      ) : (
        workspaceIds.map((workspaceId) => (
          <MyWorkspaceTasks
            key={workspaceId}
            workspaceId={workspaceId}
            tasks={all.filter((task) => task.workspaceId === workspaceId)}
          />
        ))
      )}
    </PageShell.Content>
  );
}
