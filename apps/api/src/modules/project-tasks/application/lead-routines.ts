import { LEAD_ROUTINE_KINDS, type LeadRoutineKind } from "@ngriffin_uk/polychat-schemas";
import {
  formatZonedDayLabel,
  isDailyScheduleDue,
  runEachSettled,
} from "@ngriffin_uk/polychat-utility-core";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-server/errors";

import { createServiceContext, type ServiceContext } from "~/infrastructure/context/serviceContext";
import { UserRepository } from "~/modules/user/infrastructure/UserRepository";
import { readLeadRoutines } from "~/modules/workspaces/domain/lead-routines";
import { InitiativeRepository } from "~/modules/workspaces/infrastructure/InitiativeRepository";
import {
  WorkspaceRepository,
  type WorkspaceRow,
} from "~/modules/workspaces/infrastructure/WorkspaceRepository";
import type { IEnv } from "~/types";

import { createProjectTask, startProjectTask } from "./index";
import { postToTaskThread } from "./thread";

const ROUTINE_TITLES: Record<LeadRoutineKind, string> = {
  dailyBrief: "Daily brief",
  initiativeReview: "Initiative review",
};

function routineBrief(kind: LeadRoutineKind, ownerName: string): string {
  return kind === "dailyBrief"
    ? `Write today's brief for ${ownerName}. Read the team's tasks with list_tasks and get_task, then cover what moved since the last brief, what is blocked and on whom, what is waiting on ${ownerName}, and spend against budget. Lead with decisions, keep it short enough to read in two minutes, and say plainly when nothing changed. Do not start new work here.`
    : `Review each initiative against the mission. For every initiative, read its projects' tasks, say whether it is on track, and name what is stalled. Fix what you can with your own tools: assign stalled work, propose breakdowns, escalate what needs ${ownerName}. Finish with a short summary per initiative.`;
}

async function openLeadRoutine(
  context: ServiceContext,
  workspace: WorkspaceRow,
  kind: LeadRoutineKind,
  timeZone: string,
  now: Date,
): Promise<void> {
  const leadId = workspace.lead_teammate_id;
  const projectId = workspace.setup_project_id;

  if (!leadId || !projectId) {
    return;
  }

  const user = context.requireUser();
  const { task } = await createProjectTask(context, projectId, {
    objective: `${ROUTINE_TITLES[kind]} · ${formatZonedDayLabel(now, timeZone)}`,
    description: routineBrief(kind, user.name ?? "the person responsible"),
    priority: "medium",
    owner: { type: "teammate", id: leadId },
  });

  try {
    await startProjectTask(context, projectId, task.id);
  } catch (error) {
    await postToTaskThread(context, task, {
      kind: "event",
      author: { kind: "system", name: "Routine", userId: null, teammateId: null },
      body: `The lead could not start this yet: ${getErrorMessage(error)}`,
    });
  }
}

async function runWorkspaceRoutines(env: IEnv, workspace: WorkspaceRow, now: Date): Promise<void> {
  const routines = readLeadRoutines(workspace.lead_routines);
  const due = LEAD_ROUTINE_KINDS.filter(
    (kind) =>
      routines[kind].enabled && isDailyScheduleDue(routines[kind], routines[kind].lastRunAt, now),
  );

  if (due.length === 0) {
    return;
  }

  const base = createServiceContext({ env });
  const owner = await base.repositories.get(UserRepository).getUserById(workspace.created_by);

  if (!owner) {
    return;
  }

  await base.repositories.get(WorkspaceRepository).updateWorkspace(workspace.id, {
    lead_routines: JSON.stringify({
      ...routines,
      ...Object.fromEntries(
        due.map((kind) => [kind, { ...routines[kind], lastRunAt: now.toISOString() }]),
      ),
    }),
  });

  const context = createServiceContext({ env, user: owner });
  const hasInitiatives =
    (await context.repositories.get(InitiativeRepository).listForWorkspace(workspace.id)).length >
    0;

  for (const kind of due) {
    if (kind !== "initiativeReview" || hasInitiatives) {
      await openLeadRoutine(context, workspace, kind, routines[kind].timeZone, now);
    }
  }
}

export async function runLeadRoutines(env: IEnv, now = new Date()): Promise<void> {
  const workspaces = await new WorkspaceRepository(env).listWorkspacesWithLead();

  await runEachSettled(workspaces, (workspace) => runWorkspaceRoutines(env, workspace, now));
}
