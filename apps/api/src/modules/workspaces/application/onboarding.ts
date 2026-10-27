import {
  type OnboardingState,
  type SetupPlan,
  type SetupPlanCreated,
  type SetupPlanState,
  setupPlanStateSchema,
  type StartOnboardingInput,
  type WorkInboxItem,
} from "@ngriffin_uk/polychat-schemas";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-core";
import {
  AssistantError,
  ErrorType,
  getErrorMessage,
} from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { AuditRepository } from "~/modules/audit/infrastructure/AuditRepository";
import { listConnectedConnectors } from "~/modules/connectors/application/connected";
import { createProjectTask, startProjectTask } from "~/modules/project-tasks/application";
import { postToTaskThread } from "~/modules/project-tasks/application/thread";
import { personCaller, type WorkCaller } from "~/modules/project-tasks/application/work";
import { ProjectTaskRepository } from "~/modules/project-tasks/infrastructure/ProjectTaskRepository";
import { hireTeammate } from "~/modules/teammates/application/hire";
import { employTeammate } from "~/modules/teammates/application/organisation";
import { WorkspaceTeammateRepository } from "~/modules/teammates/infrastructure/WorkspaceTeammateRepository";
import { InitiativeRepository } from "~/modules/workspaces/infrastructure/InitiativeRepository";
import {
  WorkspaceRepository,
  type WorkspaceRow,
} from "~/modules/workspaces/infrastructure/WorkspaceRepository";

import { requireWorkspaceAccess } from "./access";
import { createProject, createWorkspace } from "./index";
import { createSetupPlan } from "./setup-apply";
import { assertPlanConnectors, describeConnectedServices } from "./setup-connectors";
import { rollBackSetupCreation } from "./setup-rollback";
import { readTeamTemplatePlan } from "./team-template";

const LEAD_HEARTBEAT_MINUTES = 240;
const SETUP_FORBIDDEN_TOOLS = [
  "assign_task",
  "propose_hire",
  "create_task",
  "raise_case",
  "escalate",
  "block_task",
  "request_review",
  "review_task",
  "summarise_standup",
  "answer_standup",
];

export function readSetupState(raw: string | null | undefined): SetupPlanState | null {
  const parsed = setupPlanStateSchema.safeParse(raw ? safeParseJson(raw) : null);

  return parsed.success ? parsed.data : null;
}

export function listSetupInboxItems(
  workspaces: readonly Pick<
    WorkspaceRow,
    | "id"
    | "name"
    | "setup_plan"
    | "setup_project_id"
    | "setup_task_id"
    | "lead_teammate_id"
    | "updated_at"
    | "created_at"
  >[],
): WorkInboxItem[] {
  return workspaces.flatMap((workspace): WorkInboxItem[] => {
    const setup = readSetupState(workspace.setup_plan);

    if (!setup || setup.appliedAt) {
      return [];
    }

    return [
      {
        id: `setup:${workspace.id}:${setup.revision}`,
        kind: "setup",
        workspaceId: workspace.id,
        projectId: workspace.setup_project_id ?? null,
        taskId: workspace.setup_task_id ?? null,
        teammateId: workspace.lead_teammate_id ?? null,
        title: `Approve the setup plan for ${workspace.name}`,
        detail: `Revision ${setup.revision}: ${setup.plan.projects.length} projects, ${setup.plan.teammates.length} teammates`,
        dueAt: null,
        conversationId: null,
        since: workspace.updated_at ?? workspace.created_at,
        deepLink: `/work/${encodeURIComponent(workspace.id)}/setup`,
      },
    ];
  });
}

export async function getOnboarding(
  context: ServiceContext,
  workspaceId: string,
): Promise<OnboardingState> {
  const { workspace } = await requireWorkspaceAccess(context, workspaceId);

  if (!workspace.setup_project_id || !workspace.setup_task_id || !workspace.lead_teammate_id) {
    throw new AssistantError("This workspace has no setup in progress", ErrorType.NOT_FOUND, 404);
  }

  return {
    workspaceId,
    projectId: workspace.setup_project_id,
    setupTaskId: workspace.setup_task_id,
    leadTeammateId: workspace.lead_teammate_id,
    setup: readSetupState(workspace.setup_plan),
  };
}

export async function startOnboarding(
  context: ServiceContext,
  input: StartOnboardingInput,
): Promise<OnboardingState> {
  const user = context.requireUser();
  const template = input.templateId ? await readTeamTemplatePlan(context, input.templateId) : null;
  const workspace = await createWorkspace(context, {
    name: input.name,
    description: input.mission.slice(0, 500),
    colour: input.colour,
  });

  return setUpWorkspaceLead(context, workspace.id, {
    mission: input.mission,
    sources: input.sources,
    monthlyCreditCapMicros: input.monthlyCreditCapMicros,
    userId: user.id,
    template: template
      ? {
          name: template.name,
          plan: {
            ...template.plan,
            mission: input.mission,
            monthlyCreditCapMicros:
              input.monthlyCreditCapMicros ?? template.plan.monthlyCreditCapMicros,
          },
        }
      : null,
  });
}

export async function startWorkspaceSetup(
  context: ServiceContext,
  workspaceId: string,
): Promise<OnboardingState> {
  const user = context.requireUser();
  const { workspace } = await requireWorkspaceAccess(context, workspaceId, ["owner", "admin"]);

  if (workspace.lead_teammate_id && workspace.setup_task_id) {
    return getOnboarding(context, workspaceId);
  }

  return setUpWorkspaceLead(context, workspaceId, {
    mission: workspace.mission || workspace.description,
    sources: [],
    monthlyCreditCapMicros: workspace.monthly_credit_cap_micros ?? null,
    userId: user.id,
  });
}

async function setUpWorkspaceLead(
  context: ServiceContext,
  workspaceId: string,
  params: {
    mission: string;
    sources: string[];
    monthlyCreditCapMicros: number | null;
    userId: number;
    template?: { name: string; plan: SetupPlan } | null;
  },
): Promise<OnboardingState> {
  const workspaces = context.repositories.get(WorkspaceRepository);
  const existingProjects = await workspaces.listProjects(workspaceId);
  const project = await createProject(context, workspaceId, {
    name: "Company",
    description: "Setting up and running the workspace.",
    instructions:
      "Work here is about the workspace itself: its mission, initiatives, team and routines.",
    taskPrefix: "WRK",
  });
  const lead = await hireTeammate(context, {
    role_slug: "lead",
    name: "Lead",
    workspace_id: workspaceId,
  });

  await employTeammate(context, {
    workspaceId,
    teammateId: lead.id,
    title: "Lead",
    reportsToTeammateId: null,
    heartbeatMinutes: LEAD_HEARTBEAT_MINUTES,
    monthlyCreditCapMicros: null,
    projectIds: [project.id, ...existingProjects.map((existing) => existing.id)],
  });

  const connected = await listConnectedConnectors(context, params.userId);
  const templateNote = params.template
    ? `\n\nRevision 1 of the plan comes from the team template "${params.template.name}". Check it against the mission and sources, and call propose_setup_plan only to change what does not fit.`
    : "";
  const existingNote = existingProjects.length
    ? `\n\nThe workspace already has these projects, which the plan should keep: ${existingProjects
        .map((existing) => existing.name)
        .join(", ")}.`
    : "";
  const { task } = await createProjectTask(context, project.id, {
    objective: "Set up the workspace",
    description: `Mission: ${params.mission}${existingNote}${templateNote}\n\n${describeConnectedServices(connected)}\n\nRead the sources you were given, then call propose_setup_plan with the mission, initiatives, projects, team, budgets, wake rules, routines, first tasks and the connected services each project uses. Do not hire, assign or schedule anything yourself: the plan starts only after a person approves it.`,
    priority: "high",
    owner: { type: "teammate", id: lead.id },
    context: {
      links: params.sources.map((url) => ({ url, label: null })),
      notes: null,
    },
    constraints: { forbiddenTools: SETUP_FORBIDDEN_TOOLS, notes: null },
  });

  await workspaces.updateWorkspace(workspaceId, {
    mission: params.mission,
    monthly_credit_cap_micros: params.monthlyCreditCapMicros,
    lead_teammate_id: lead.id,
    setup_project_id: project.id,
    setup_task_id: task.id,
  });

  if (params.template) {
    await proposeSetupPlan(context, workspaceId, params.template.plan, personCaller(context));
  }

  try {
    await startProjectTask(context, project.id, task.id);
  } catch (error) {
    await postToTaskThread(context, task, {
      kind: "event",
      author: { kind: "system", name: "Setup", userId: null, teammateId: null },
      body: `The lead could not start yet: ${getErrorMessage(error)}`,
    });
  }

  return getOnboarding(context, workspaceId);
}

export async function proposeSetupPlan(
  context: ServiceContext,
  workspaceId: string,
  plan: SetupPlan,
  caller: WorkCaller,
): Promise<SetupPlanState> {
  const { workspace } = await requireWorkspaceAccess(context, workspaceId);
  const current = readSetupState(workspace.setup_plan);

  if (current?.appliedAt) {
    throw new AssistantError(
      "The setup plan has already been applied",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  await assertPlanConnectors(context, plan);

  const next: SetupPlanState = {
    revision: (current?.revision ?? 0) + 1,
    plan,
    appliedAt: null,
    created: null,
    failure: null,
  };

  await context.repositories
    .get(WorkspaceRepository)
    .updateWorkspace(workspaceId, { setup_plan: JSON.stringify(next) });

  const setupTask = workspace.setup_task_id
    ? await context.repositories.get(ProjectTaskRepository).getTaskById(workspace.setup_task_id)
    : null;

  if (setupTask) {
    await postToTaskThread(context, setupTask, {
      kind: "update",
      author: caller.author,
      body: `Setup plan revision ${next.revision} is ready for approval: ${plan.projects.length} projects, ${plan.teammates.length} teammates, ${plan.initiatives.length} initiatives and ${plan.tasks.length} first tasks.`,
    });
  }

  return next;
}

export async function reviseSetupPlan(
  context: ServiceContext,
  workspaceId: string,
  plan: SetupPlan,
  expectedRevision: number | null,
): Promise<SetupPlanState> {
  const { workspace } = await requireWorkspaceAccess(context, workspaceId, ["owner", "admin"]);
  const current = readSetupState(workspace.setup_plan);

  if ((current?.revision ?? null) !== expectedRevision) {
    throw new AssistantError(
      "The setup plan changed while you were editing. Reload it and try again.",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  return proposeSetupPlan(context, workspaceId, plan, personCaller(context));
}

export async function approveSetupPlan(
  context: ServiceContext,
  workspaceId: string,
  revision: number,
): Promise<SetupPlanState> {
  const user = context.requireUser();
  const { workspace } = await requireWorkspaceAccess(context, workspaceId, ["owner", "admin"]);
  const state = readSetupState(workspace.setup_plan);

  if (!state || state.revision !== revision) {
    throw new AssistantError(
      "That revision is no longer current. Review the latest plan first.",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  if (state.appliedAt) {
    return state;
  }

  const { plan } = state;
  const workspaces = context.repositories.get(WorkspaceRepository);
  const leadId = workspace.lead_teammate_id ?? null;
  const created: SetupPlanCreated = {
    projectIds: [],
    teammateIds: [],
    initiativeIds: [],
    taskIds: [],
  };
  const toStart: { projectId: string; taskId: string }[] = [];

  try {
    await createSetupPlan(context, {
      workspaceId,
      plan,
      leadId,
      userId: user.id,
      created,
      toStart,
    });
  } catch (error) {
    const message = getErrorMessage(error, "Setup could not finish");
    const problems = await rollBackSetupCreation(context, workspaceId, created);

    await workspaces.updateWorkspace(workspaceId, {
      setup_plan: JSON.stringify({
        ...state,
        failure: { at: new Date().toISOString(), revision, message },
      } satisfies SetupPlanState),
    });
    await context.repositories.get(AuditRepository).createRecord({
      workspaceId,
      actorUserId: user.id,
      action: "workspace.setup.failed",
      targetType: "workspace",
      targetId: workspaceId,
      metadata: { revision, message, rollbackProblems: problems },
    });

    throw new AssistantError(
      `Setup stopped and nothing it made was kept: ${message}`,
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  await workspaces.updateWorkspace(workspaceId, {
    mission: plan.mission,
    monthly_credit_cap_micros: plan.monthlyCreditCapMicros,
  });

  for (const planned of toStart) {
    try {
      await startProjectTask(context, planned.projectId, planned.taskId);
    } catch {
      continue;
    }
  }

  const applied: SetupPlanState = {
    ...state,
    appliedAt: new Date().toISOString(),
    created,
    failure: null,
  };

  await workspaces.updateWorkspace(workspaceId, { setup_plan: JSON.stringify(applied) });

  if (workspace.setup_task_id) {
    const setupTask = await context.repositories
      .get(ProjectTaskRepository)
      .updateTask(workspace.setup_task_id, {
        status: "done",
        blockedReason: null,
        blockedDetail: null,
        completedAt: applied.appliedAt,
      });

    if (setupTask) {
      await postToTaskThread(context, setupTask, {
        kind: "event",
        author: personCaller(context).author,
        body: `Approved revision ${revision}. Created ${created.projectIds.length} projects, ${created.teammateIds.length} teammates and ${created.taskIds.length} tasks.`,
      });
    }
  }

  await context.repositories.get(AuditRepository).createRecord({
    workspaceId,
    actorUserId: user.id,
    action: "workspace.setup.applied",
    targetType: "workspace",
    targetId: workspaceId,
    metadata: { revision },
  });

  return applied;
}

export async function archiveSetup(context: ServiceContext, workspaceId: string): Promise<void> {
  const user = context.requireUser();
  const { workspace } = await requireWorkspaceAccess(context, workspaceId, ["owner", "admin"]);
  const state = readSetupState(workspace.setup_plan);

  if (!state?.created) {
    return;
  }

  const now = new Date().toISOString();

  for (const projectId of state.created.projectIds) {
    await context.repositories
      .get(WorkspaceRepository)
      .updateProject(projectId, { archived_at: now });
  }

  for (const initiativeId of state.created.initiativeIds) {
    await context.repositories.get(InitiativeRepository).delete(initiativeId);
  }

  for (const teammateId of state.created.teammateIds) {
    await context.repositories
      .get(WorkspaceTeammateRepository)
      .update(workspaceId, teammateId, { status: "archived", pausedReason: null });
  }

  if (workspace.setup_task_id) {
    await context.repositories
      .get(ProjectTaskRepository)
      .updateTask(workspace.setup_task_id, { status: "cancelled" });
  }

  await context.repositories.get(AuditRepository).createRecord({
    workspaceId,
    actorUserId: user.id,
    action: "workspace.setup.archived",
    targetType: "workspace",
    targetId: workspaceId,
  });
}
