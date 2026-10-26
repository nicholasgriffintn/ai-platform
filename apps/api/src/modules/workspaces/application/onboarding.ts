import {
  setupPlanStateSchema,
  type OnboardingState,
  type SetupPlan,
  type SetupPlanCreated,
  type SetupPlanState,
  type StartOnboardingInput,
} from "@ngriffin_uk/polychat-schemas";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-core";
import {
  AssistantError,
  ErrorType,
  getErrorMessage,
} from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { AuditRepository } from "~/modules/audit/infrastructure/AuditRepository";
import {
  connectorOperationsForAccess,
  listConnectedConnectors,
  type ConnectedConnector,
} from "~/modules/connectors/application/connected";
import { createProjectTask, startProjectTask } from "~/modules/project-tasks/application";
import { postToTaskThread } from "~/modules/project-tasks/application/thread";
import type { WorkCaller } from "~/modules/project-tasks/application/work";
import { ProjectTaskRepository } from "~/modules/project-tasks/infrastructure/ProjectTaskRepository";
import { hireTeammate } from "~/modules/teammates/application/hire";
import { employTeammate } from "~/modules/teammates/application/organisation";
import { WorkspaceTeammateRepository } from "~/modules/teammates/infrastructure/WorkspaceTeammateRepository";
import { instantiateProjectStarter } from "~/modules/templates/application/starters";
import { InitiativeRepository } from "~/modules/workspaces/infrastructure/InitiativeRepository";
import { WorkspaceRepository } from "~/modules/workspaces/infrastructure/WorkspaceRepository";

import { requireWorkspaceAccess } from "./access";
import { addProjectCapability, createProject, createWorkspace } from "./index";
import { rollBackSetupCreation } from "./setup-rollback";

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

function readSetupState(raw: string | null | undefined): SetupPlanState | null {
  const parsed = setupPlanStateSchema.safeParse(raw ? safeParseJson(raw) : null);

  return parsed.success ? parsed.data : null;
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
  const existingNote = existingProjects.length
    ? `\n\nThe workspace already has these projects, which the plan should keep: ${existingProjects
        .map((existing) => existing.name)
        .join(", ")}.`
    : "";
  const { task } = await createProjectTask(context, project.id, {
    objective: "Set up the workspace",
    description: `Mission: ${params.mission}${existingNote}\n\n${describeConnectedServices(connected)}\n\nRead the sources you were given, then call propose_setup_plan with the mission, initiatives, projects, team, budgets, wake rules, routines, first tasks and the connected services each project uses. Do not hire, assign or schedule anything yourself: the plan starts only after a person approves it.`,
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

function describeConnectedServices(connected: readonly ConnectedConnector[]): string {
  return connected.length
    ? `Connected services the plan may use: ${connected.map((connector) => `${connector.name} (${connector.id})`).join(", ")}. Use only these in the plan's connectors, and only the access each project needs. Put any other service you think would help in suggestions; nothing is connected for the person.`
    : "Nothing is connected yet, so the plan uses no services. Put any service you think would help in suggestions; nothing is connected for the person.";
}

async function assertPlanConnectors(context: ServiceContext, plan: SetupPlan): Promise<void> {
  if (plan.connectors.length === 0) {
    return;
  }

  const connected = new Set(
    (await listConnectedConnectors(context, context.requireUser().id)).map(
      (connector) => connector.id,
    ),
  );
  const projectKeys = new Set(plan.projects.map((project) => project.key));
  const problems = plan.connectors.flatMap((connector) => [
    ...(connected.has(connector.provider)
      ? []
      : [`${connector.provider} is not connected; move it to suggestions`]),
    ...connector.projects
      .filter((key) => !projectKeys.has(key))
      .map((key) => `${connector.provider} names a project key that is not in the plan: ${key}`),
  ]);

  if (problems.length > 0) {
    throw new AssistantError(problems.join(". "), ErrorType.PARAMS_ERROR, 400);
  }
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
    approvedRevision: null,
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

  const user = context.requireUser();

  return proposeSetupPlan(context, workspaceId, plan, {
    actor: { type: "person", userId: user.id },
    author: { kind: "person", name: user.name ?? "Someone", userId: user.id, teammateId: null },
  });
}

async function createSetupPlan(
  context: ServiceContext,
  input: {
    workspaceId: string;
    plan: SetupPlan;
    leadId: string | null;
    userId: number;
    created: SetupPlanCreated;
    toStart: { projectId: string; taskId: string }[];
  },
): Promise<void> {
  const { workspaceId, plan, leadId, created } = input;
  const workspaces = context.repositories.get(WorkspaceRepository);

  await assertPlanConnectors(context, plan);

  const initiativeIds = new Map<string, string>();

  for (const initiative of plan.initiatives) {
    const row = await context.repositories.get(InitiativeRepository).create({
      workspaceId,
      name: initiative.name,
      description: initiative.description,
      status: "active",
      targetDate: null,
      ownerTeammateId: leadId,
    });

    initiativeIds.set(initiative.key, row.id);
    created.initiativeIds.push(row.id);
  }

  const projectIds = new Map<string, string>();

  for (const project of plan.projects) {
    const createdProject = project.starterId
      ? await instantiateProjectStarter(
          context,
          input.userId,
          project.starterId,
          workspaceId,
          project.name,
        )
      : await createProject(context, workspaceId, {
          name: project.name,
          description: project.description,
          instructions: "",
          taskPrefix: project.taskPrefix,
        });

    created.projectIds.push(createdProject.id);
    await workspaces.updateProject(createdProject.id, {
      task_prefix: project.taskPrefix,
      initiative_id: project.initiative ? (initiativeIds.get(project.initiative) ?? null) : null,
      ...(project.standup ? { standup: JSON.stringify(project.standup) } : {}),
    });
    projectIds.set(project.key, createdProject.id);
  }

  const teammateIds = new Map<string, string>(leadId ? [["lead", leadId]] : []);

  for (const teammate of plan.teammates) {
    const hired = await hireTeammate(context, {
      ...(teammate.roleSlug ? { role_slug: teammate.roleSlug } : {}),
      ...(teammate.jobDescription ? { job_description: teammate.jobDescription } : {}),
      name: teammate.name,
      workspace_id: workspaceId,
    });

    teammateIds.set(teammate.key, hired.id);
    created.teammateIds.push(hired.id);
  }

  for (const teammate of plan.teammates) {
    const teammateId = teammateIds.get(teammate.key);

    if (!teammateId) {
      continue;
    }

    await employTeammate(context, {
      workspaceId,
      teammateId,
      title: teammate.title,
      reportsToTeammateId: teammate.reportsTo
        ? (teammateIds.get(teammate.reportsTo) ?? leadId)
        : leadId,
      heartbeatMinutes: teammate.heartbeatMinutes,
      monthlyCreditCapMicros: teammate.monthlyCreditCapMicros,
      projectIds: teammate.projects.flatMap((key) => {
        const projectId = projectIds.get(key);

        return projectId ? [projectId] : [];
      }),
    });
  }

  for (const planned of plan.tasks) {
    const projectId = projectIds.get(planned.project);

    if (!projectId) {
      continue;
    }

    const ownerId = planned.owner ? teammateIds.get(planned.owner) : undefined;
    const { task } = await createProjectTask(context, projectId, {
      objective: planned.objective,
      priority: planned.priority,
      ...(ownerId ? { owner: { type: "teammate", id: ownerId } } : {}),
    });

    created.taskIds.push(task.id);

    if (ownerId) {
      input.toStart.push({ projectId, taskId: task.id });
    }
  }

  for (const connector of plan.connectors) {
    const operations = connectorOperationsForAccess(connector.provider, connector.access);

    for (const key of connector.projects) {
      const projectId = projectIds.get(key);

      if (projectId && operations.length > 0) {
        await addProjectCapability(context, projectId, {
          kind: "connector",
          capabilityId: connector.provider,
          configuration: { operations },
        });
      }
    }
  }
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
    approvedRevision: revision,
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
        author: { kind: "person", name: user.name ?? "Someone", userId: user.id, teammateId: null },
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
