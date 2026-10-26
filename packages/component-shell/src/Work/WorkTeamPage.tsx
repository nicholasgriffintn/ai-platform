import { BackLink, Button } from "@ngriffin_uk/polychat-component-ui";
import {
  HeartbeatRails,
  ProposeHireDialog,
  TeamMemberEditor,
  TeamOrgChart,
  LeadRoutinesForm,
  SaveTeamTemplateDialog,
  TeammateProfileHeader,
  WorkTaskList,
} from "@ngriffin_uk/polychat-component-workspaces";
import {
  canManageWorkspace,
  getProjectTaskPath,
  useSetupActions,
  useSaveTeamTemplate,
  useTeamActions,
  useUpdateWorkspaceOrganisation,
  useWorkRails,
  useWorkspace,
  useWorkspaceTasks,
  useWorkspaceTeam,
} from "@ngriffin_uk/polychat-library-react";
import type { WorkRailBeat } from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import { Copy, Plus } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import { PageShell } from "../Shell/PageShell.js";
import { useWorkDirectory } from "./useWorkDirectory.js";

function beatHref(workspaceId: string) {
  return (beat: WorkRailBeat) =>
    beat.taskId && beat.projectId
      ? getProjectTaskPath(workspaceId, beat.projectId, beat.taskId)
      : null;
}

export function WorkTeamPage({ workspaceId }: { workspaceId: string }) {
  const navigate = useNavigate();
  const workspaceQuery = useWorkspace(workspaceId);
  const teamQuery = useWorkspaceTeam(workspaceId);
  const team = teamQuery.data?.teammates ?? [];
  const rails = useWorkRails(workspaceId);
  const actions = useTeamActions(workspaceId);
  const setup = useSetupActions(workspaceId);
  const [isProposeOpen, setIsProposeOpen] = useState(false);
  const [isTemplateOpen, setIsTemplateOpen] = useState(false);
  const saveTemplate = useSaveTeamTemplate(workspaceId);
  const workspace = workspaceQuery.data;
  const hasLead = Boolean(teamQuery.data?.leadTeammateId);
  const canManage = Boolean(workspace && canManageWorkspace(workspace));

  return (
    <PageShell.Content className="max-w-6xl space-y-8">
      <PageShell.Header
        title="Team"
        actions={[
          {
            label: "Propose a hire",
            icon: <Plus size={17} />,
            onClick: () => setIsProposeOpen(true),
          },
          ...(canManage && team.length
            ? [
                {
                  label: "Save as template",
                  icon: <Copy size={17} />,
                  onClick: () => setIsTemplateOpen(true),
                },
              ]
            : []),
        ]}
      />

      {teamQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading the team…</p>
      ) : teamQuery.error ? (
        <p role="alert" className="text-sm text-failure">
          {getErrorMessage(teamQuery.error, "The team could not be loaded")}
        </p>
      ) : (
        <>
          {!hasLead && canManage ? (
            <div className="rounded-lg border border-dashed border-border p-5 text-sm">
              <p className="font-medium">No lead yet</p>
              <p className="mt-1 text-muted-foreground">
                A lead reads your projects, proposes a team, budgets and routines, and runs them
                once you approve the plan.
              </p>
              <Button
                className="mt-3"
                size="sm"
                variant="primary"
                disabled={setup.start.isPending}
                onClick={() =>
                  setup.start.mutate(undefined, {
                    onSuccess: () => void navigate(`/work/${workspaceId}/setup`),
                    onError: (error) =>
                      toast.error(getErrorMessage(error, "The lead could not be hired")),
                  })
                }
              >
                Hire a lead and plan the team
              </Button>
            </div>
          ) : null}

          <section className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold">Reporting lines</h2>
              <p className="text-sm text-muted-foreground">
                Work is handed down this chart and escalations go up it. Open a teammate to change
                its manager, budget or how often it wakes.
              </p>
            </div>
            <TeamOrgChart
              boardName={workspace?.name ?? "The board"}
              teammates={team}
              teammateHref={(teammate) => `/work/${workspaceId}/team/${teammate.teammateId}`}
            />
          </section>

          <section className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold">Heartbeats</h2>
              <p className="text-sm text-muted-foreground">
                Each mark is a run over the last day, with the next scheduled wakes on the right.
                Select one to open its task.
              </p>
            </div>
            {rails.data ? (
              <HeartbeatRails
                rails={rails.data}
                teammates={team}
                beatHref={beatHref(workspaceId)}
              />
            ) : (
              <p className="text-sm text-muted-foreground">Loading heartbeats…</p>
            )}
          </section>
        </>
      )}

      <SaveTeamTemplateDialog
        key={String(isTemplateOpen)}
        open={isTemplateOpen}
        defaultName={`${workspace?.name ?? "Team"} team`}
        isSaving={saveTemplate.isPending}
        onOpenChange={setIsTemplateOpen}
        onSubmit={(input) =>
          saveTemplate
            .mutateAsync(input)
            .then(() => toast.success("Saved. New workspaces can start from it."))
            .catch((error: unknown) => {
              toast.error(getErrorMessage(error, "The template could not be saved"));
              throw error;
            })
        }
      />
      <ProposeHireDialog
        open={isProposeOpen}
        teammates={team}
        isSaving={actions.propose.isPending}
        errorMessage={
          actions.propose.error ? getErrorMessage(actions.propose.error, "") : undefined
        }
        onOpenChange={setIsProposeOpen}
        onSubmit={async (input) => {
          await actions.propose.mutateAsync(input);
          toast.success("Hire proposed. An owner or admin decides in Inbox.");
          setIsProposeOpen(false);
        }}
      />
    </PageShell.Content>
  );
}

export function WorkTeammatePage({
  workspaceId,
  teammateId,
}: {
  workspaceId: string;
  teammateId: string;
}) {
  const { directory, workspaceQuery } = useWorkDirectory(workspaceId);
  const teamQuery = useWorkspaceTeam(workspaceId);
  const team = teamQuery.data?.teammates ?? [];
  const tasks = useWorkspaceTasks(workspaceId, teammateId);
  const rails = useWorkRails(workspaceId);
  const actions = useTeamActions(workspaceId);
  const updateOrganisation = useUpdateWorkspaceOrganisation(workspaceId);
  const teammate = team.find((candidate) => candidate.teammateId === teammateId);
  const workspace = workspaceQuery.data;
  const canManage = Boolean(workspace && canManageWorkspace(workspace));
  const rail = rails.data
    ? { ...rails.data, rails: rails.data.rails.filter((entry) => entry.teammateId === teammateId) }
    : null;

  if (teamQuery.isLoading) {
    return (
      <PageShell.Content className="max-w-6xl">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </PageShell.Content>
    );
  }

  if (!teammate) {
    return (
      <PageShell.Content className="max-w-6xl">
        <BackLink href={`/work/${workspaceId}/team`} label="Back to the team" />
        <p role="alert" className="text-sm text-failure">
          That teammate is not on this team.
        </p>
      </PageShell.Content>
    );
  }

  const manager = team.find((candidate) => candidate.teammateId === teammate.reportsToTeammateId);
  const decide = (decision: "approve" | "reject") =>
    void actions.decide
      .mutateAsync({ teammateId, decision })
      .then(() =>
        toast.success(decision === "approve" ? `${teammate.name} is on the team` : "Hire rejected"),
      )
      .catch((error: unknown) => toast.error(getErrorMessage(error, "That did not work")));
  const togglePause = () =>
    void actions.update
      .mutateAsync({
        teammateId,
        changes: { status: teammate.status === "paused" ? "active" : "paused" },
      })
      .catch((error: unknown) => toast.error(getErrorMessage(error, "That did not work")));

  return (
    <PageShell.Content className="max-w-6xl space-y-8">
      <BackLink href={`/work/${workspaceId}/team`} label="Back to the team" />
      <PageShell.Header title={teammate.name} />

      <TeammateProfileHeader
        teammate={teammate}
        managerName={manager?.name ?? workspace?.name ?? "the board"}
        actions={
          canManage ? (
            teammate.status === "proposed" ? (
              <>
                <Button
                  size="sm"
                  variant="primary"
                  disabled={actions.decide.isPending}
                  onClick={() => decide("approve")}
                >
                  Approve hire
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={actions.decide.isPending}
                  onClick={() => decide("reject")}
                >
                  Reject
                </Button>
              </>
            ) : teammate.status !== "archived" ? (
              <Button
                size="sm"
                variant="secondary"
                disabled={actions.update.isPending}
                onClick={togglePause}
              >
                {teammate.status === "paused" ? "Resume" : "Pause"}
              </Button>
            ) : null
          ) : null
        }
      />

      {rail ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Heartbeat</h2>
          <HeartbeatRails rails={rail} teammates={team} beatHref={beatHref(workspaceId)} />
        </section>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="min-w-0 space-y-3">
          <h2 className="text-sm font-semibold">Owned or waiting for review</h2>
          <WorkTaskList
            tasks={tasks.data?.tasks ?? []}
            directory={directory}
            taskHref={(task) => getProjectTaskPath(workspaceId, task.projectId, task.id)}
            emptyMessage={`${teammate.name} has no open work.`}
          />
        </section>
        {teammate.status !== "proposed" ? (
          <div className="space-y-8">
            <section className="space-y-3">
              <h2 className="text-sm font-semibold">Place on the team</h2>
              <TeamMemberEditor
                key={`${teammate.teammateId}-${teammate.status}-${teammate.monthlyCreditCapMicros}`}
                teammate={teammate}
                teammates={team}
                projects={(workspace?.projects ?? []).map((project) => ({
                  id: project.id,
                  name: project.name,
                }))}
                canManage={canManage}
                isSaving={actions.update.isPending}
                onSave={(changes) =>
                  void actions.update
                    .mutateAsync({ teammateId, changes })
                    .then(() => toast.success("Saved"))
                    .catch((error: unknown) =>
                      toast.error(getErrorMessage(error, "Could not save those changes")),
                    )
                }
              />
            </section>
            {workspace && workspace.leadTeammateId === teammateId ? (
              <section className="space-y-3">
                <h2 className="text-sm font-semibold">Routines</h2>
                <LeadRoutinesForm
                  key={JSON.stringify(workspace.leadRoutines)}
                  routines={workspace.leadRoutines}
                  canManage={canManage}
                  isSaving={updateOrganisation.isPending}
                  onSave={(leadRoutines) =>
                    void updateOrganisation
                      .mutateAsync({ leadRoutines })
                      .then(() => toast.success("Routines saved"))
                      .catch((error: unknown) =>
                        toast.error(getErrorMessage(error, "Could not save the routines")),
                      )
                  }
                />
              </section>
            ) : null}
          </div>
        ) : null}
      </div>
    </PageShell.Content>
  );
}
