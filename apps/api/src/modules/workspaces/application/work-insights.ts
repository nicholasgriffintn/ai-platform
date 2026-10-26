import {
  usagePeriodFromDate,
  type WorkCostsResponse,
  type WorkRailBeat,
  type WorkRailsResponse,
  type WorkSpendRow,
} from "@ngriffin_uk/polychat-schemas";
import { parseStoredTimestamp } from "@ngriffin_uk/polychat-utility-core";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { ProjectTaskRepository } from "~/modules/project-tasks/infrastructure/ProjectTaskRepository";
import { TeammateRepository } from "~/modules/teammates/infrastructure/TeammateRepository";
import { WorkspaceTeammateRepository } from "~/modules/teammates/infrastructure/WorkspaceTeammateRepository";
import { UsageEventRepository } from "~/modules/usage/infrastructure/UsageEventRepository";
import { InitiativeRepository } from "~/modules/workspaces/infrastructure/InitiativeRepository";
import { WorkspaceRepository } from "~/modules/workspaces/infrastructure/WorkspaceRepository";

import { requireWorkspaceAccess } from "./access";

const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;
const RAIL_FUTURE_SHARE = 0.25;
const RUNNING_STATUSES = new Set(["accepted", "running", "cancelling"]);
const BLOCKED_STATUSES = new Set([
  "awaiting_input",
  "awaiting_approval",
  "awaiting_takeover",
  "failed",
  "interrupted",
]);

export async function getWorkCosts(
  context: ServiceContext,
  workspaceId: string,
  requestedPeriod?: string,
): Promise<WorkCostsResponse> {
  const { workspace } = await requireWorkspaceAccess(context, workspaceId);
  const period = requestedPeriod ?? usagePeriodFromDate();
  const usage = context.repositories.get(UsageEventRepository);
  const [byTeammate, byProject, byTask, projects, initiatives, employments] = await Promise.all([
    usage.summariseWorkspaceSpend({ workspaceId, period, groupBy: "teammate" }),
    usage.summariseWorkspaceSpend({ workspaceId, period, groupBy: "project" }),
    usage.summariseWorkspaceSpend({ workspaceId, period, groupBy: "task" }),
    context.repositories.get(WorkspaceRepository).listProjects(workspaceId),
    context.repositories.get(InitiativeRepository).listForWorkspace(workspaceId),
    context.repositories.get(WorkspaceTeammateRepository).listForWorkspace(workspaceId),
  ]);
  const [teammates, tasks] = await Promise.all([
    context.repositories
      .get(TeammateRepository)
      .getTeammatesByIds(byTeammate.map((row) => row.group_id)),
    context.repositories
      .get(ProjectTaskRepository)
      .listTasksByIds(byTask.slice(0, 50).map((row) => row.group_id)),
  ]);
  const teammateNames = new Map(teammates.map((teammate) => [teammate.id, teammate.name]));
  const caps = new Map(
    employments.map((employment) => [employment.teammateId, employment.monthlyCreditCapMicros]),
  );
  const projectNames = new Map(projects.map((project) => [project.id, project.name]));
  const taskNames = new Map(
    tasks.map((task) => [task.id, `${task.key ?? task.id} ${task.objective}`]),
  );
  const projectRows: WorkSpendRow[] = byProject.map((row) => ({
    id: row.group_id,
    name: projectNames.get(row.group_id) ?? "Archived project",
    creditMicros: row.credit_micros,
    costMicros: row.cost_micros,
    runCount: row.run_count,
    capCreditMicros: null,
  }));
  const initiativeRows: WorkSpendRow[] = initiatives.map((initiative) => {
    const members = projects.filter((project) => project.initiative_id === initiative.id);
    const rows = projectRows.filter((row) => members.some((project) => project.id === row.id));

    return {
      id: initiative.id,
      name: initiative.name,
      creditMicros: rows.reduce((sum, row) => sum + row.creditMicros, 0),
      costMicros: rows.reduce((sum, row) => sum + row.costMicros, 0),
      runCount: rows.reduce((sum, row) => sum + row.runCount, 0),
      capCreditMicros: null,
    };
  });

  return {
    period,
    totalCreditMicros: projectRows.reduce((sum, row) => sum + row.creditMicros, 0),
    capCreditMicros: workspace.monthly_credit_cap_micros ?? null,
    teammates: byTeammate.map((row) => ({
      id: row.group_id,
      name: teammateNames.get(row.group_id) ?? "Former teammate",
      creditMicros: row.credit_micros,
      costMicros: row.cost_micros,
      runCount: row.run_count,
      capCreditMicros: caps.get(row.group_id) ?? null,
    })),
    projects: projectRows,
    initiatives: initiativeRows,
    tasks: byTask.slice(0, 50).map((row) => ({
      id: row.group_id,
      name: taskNames.get(row.group_id) ?? "Deleted task",
      creditMicros: row.credit_micros,
      costMicros: row.cost_micros,
      runCount: row.run_count,
      capCreditMicros: null,
    })),
  };
}

function classifyRun(status: string): WorkRailBeat["kind"] {
  if (RUNNING_STATUSES.has(status)) {
    return "running";
  }

  return BLOCKED_STATUSES.has(status) ? "blocked" : "ran";
}

export async function getWorkRails(
  context: ServiceContext,
  workspaceId: string,
  hours: number,
): Promise<WorkRailsResponse> {
  await requireWorkspaceAccess(context, workspaceId);
  const now = Date.now();
  const futureMs = hours * HOUR_MS * RAIL_FUTURE_SHARE;
  const from = new Date(now - hours * HOUR_MS + futureMs);
  const to = new Date(now + futureMs);
  const repository = context.repositories.get(WorkspaceTeammateRepository);
  const [employments, runs] = await Promise.all([
    repository.listForWorkspace(workspaceId),
    repository.listRecentRuns(workspaceId, from.toISOString()),
  ]);
  const tasks = await context.repositories
    .get(ProjectTaskRepository)
    .listTasksByIds([
      ...new Set(runs.flatMap((run) => (run.project_task_id ? [run.project_task_id] : []))),
    ]);
  const taskLabels = new Map(tasks.map((task) => [task.id, task.key ?? task.objective]));

  return {
    from: from.toISOString(),
    to: to.toISOString(),
    rails: employments
      .filter((employment) => employment.status !== "proposed")
      .map((employment) => {
        const ran: WorkRailBeat[] = runs
          .filter((run) => run.teammate_id === employment.teammateId)
          .map((run) => ({
            at: run.created_at,
            kind: classifyRun(run.status),
            trigger: run.trigger,
            label: run.project_task_id ? (taskLabels.get(run.project_task_id) ?? null) : null,
            runId: run.id,
            taskId: run.project_task_id,
            projectId: run.project_id,
          }));
        const scheduled: WorkRailBeat[] = [];

        if (employment.status === "active" && employment.heartbeatMinutes) {
          const step = employment.heartbeatMinutes * MINUTE_MS;
          let next = Math.max(parseStoredTimestamp(employment.lastHeartbeatAt) + step, now);

          while (next <= to.getTime() && scheduled.length < 200) {
            scheduled.push({
              at: new Date(next).toISOString(),
              kind: "scheduled",
              trigger: "schedule",
              label: null,
              runId: null,
              taskId: null,
              projectId: null,
            });
            next += step;
          }
        }

        return { teammateId: employment.teammateId, beats: [...ran, ...scheduled] };
      }),
  };
}
