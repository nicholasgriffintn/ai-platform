import type { SetupPlan, SetupPlanCreated } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { providerOperationsForAccess } from "~/modules/connectors/application/connected";
import { createProjectTask } from "~/modules/project-tasks/application";
import { hireTeammate } from "~/modules/teammates/application/hire";
import { employTeammate } from "~/modules/teammates/application/organisation";
import { instantiateProjectStarter } from "~/modules/templates/application/starters";
import { InitiativeRepository } from "~/modules/workspaces/infrastructure/InitiativeRepository";
import { WorkspaceRepository } from "~/modules/workspaces/infrastructure/WorkspaceRepository";

import { addProjectCapability, createProject } from "./index";
import { assertPlanConnectors } from "./setup-connectors";

export interface SetupApplication {
  workspaceId: string;
  plan: SetupPlan;
  leadId: string | null;
  userId: number;
  created: SetupPlanCreated;
  toStart: { projectId: string; taskId: string }[];
}

type KeyedIds = Map<string, string>;

async function createInitiatives(
  context: ServiceContext,
  application: SetupApplication,
): Promise<KeyedIds> {
  const ids: KeyedIds = new Map();

  for (const initiative of application.plan.initiatives) {
    const row = await context.repositories.get(InitiativeRepository).create({
      workspaceId: application.workspaceId,
      name: initiative.name,
      description: initiative.description,
      status: "active",
      targetDate: null,
      ownerTeammateId: application.leadId,
    });

    ids.set(initiative.key, row.id);
    application.created.initiativeIds.push(row.id);
  }

  return ids;
}

async function createProjects(
  context: ServiceContext,
  application: SetupApplication,
  initiativeIds: KeyedIds,
): Promise<KeyedIds> {
  const ids: KeyedIds = new Map();

  for (const project of application.plan.projects) {
    const createdProject = project.starterId
      ? await instantiateProjectStarter(
          context,
          application.userId,
          project.starterId,
          application.workspaceId,
          project.name,
        )
      : await createProject(context, application.workspaceId, {
          name: project.name,
          description: project.description,
          instructions: "",
          taskPrefix: project.taskPrefix,
        });

    application.created.projectIds.push(createdProject.id);
    await context.repositories.get(WorkspaceRepository).updateProject(createdProject.id, {
      task_prefix: project.taskPrefix,
      initiative_id: project.initiative ? (initiativeIds.get(project.initiative) ?? null) : null,
      ...(project.standup ? { standup: JSON.stringify(project.standup) } : {}),
    });
    ids.set(project.key, createdProject.id);
  }

  return ids;
}

async function hireTeam(
  context: ServiceContext,
  application: SetupApplication,
  projectIds: KeyedIds,
): Promise<KeyedIds> {
  const { plan, workspaceId, leadId } = application;
  const ids: KeyedIds = new Map(leadId ? [["lead", leadId]] : []);

  for (const teammate of plan.teammates) {
    const hired = await hireTeammate(context, {
      ...(teammate.roleSlug ? { role_slug: teammate.roleSlug } : {}),
      ...(teammate.jobDescription ? { job_description: teammate.jobDescription } : {}),
      name: teammate.name,
      workspace_id: workspaceId,
    });

    ids.set(teammate.key, hired.id);
    application.created.teammateIds.push(hired.id);
  }

  for (const teammate of plan.teammates) {
    const teammateId = ids.get(teammate.key);

    if (!teammateId) {
      continue;
    }

    await employTeammate(context, {
      workspaceId,
      teammateId,
      title: teammate.title,
      reportsToTeammateId: teammate.reportsTo ? (ids.get(teammate.reportsTo) ?? leadId) : leadId,
      heartbeatMinutes: teammate.heartbeatMinutes,
      monthlyCreditCapMicros: teammate.monthlyCreditCapMicros,
      projectIds: teammate.projects.flatMap((key) => {
        const projectId = projectIds.get(key);

        return projectId ? [projectId] : [];
      }),
    });
  }

  return ids;
}

async function createFirstTasks(
  context: ServiceContext,
  application: SetupApplication,
  projectIds: KeyedIds,
  teammateIds: KeyedIds,
): Promise<void> {
  for (const planned of application.plan.tasks) {
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

    application.created.taskIds.push(task.id);

    if (ownerId) {
      application.toStart.push({ projectId, taskId: task.id });
    }
  }
}

async function grantConnectors(
  context: ServiceContext,
  application: SetupApplication,
  projectIds: KeyedIds,
): Promise<void> {
  for (const connector of application.plan.connectors) {
    const operations = providerOperationsForAccess(connector.provider, connector.access);

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

export async function createSetupPlan(
  context: ServiceContext,
  application: SetupApplication,
): Promise<void> {
  await assertPlanConnectors(context, application.plan);

  const initiativeIds = await createInitiatives(context, application);
  const projectIds = await createProjects(context, application, initiativeIds);
  const teammateIds = await hireTeam(context, application, projectIds);

  await createFirstTasks(context, application, projectIds, teammateIds);
  await grantConnectors(context, application, projectIds);
}
