import type {
  CreateInitiativeInput,
  Initiative,
  InitiativeListResponse,
  UpdateInitiativeInput,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { InitiativeRow } from "~/infrastructure/database/schema";
import { AuditRepository } from "~/modules/audit/infrastructure/AuditRepository";
import { InitiativeRepository } from "~/modules/workspaces/infrastructure/InitiativeRepository";
import { WorkspaceRepository } from "~/modules/workspaces/infrastructure/WorkspaceRepository";

import { requireWorkspaceAccess } from "./access";

function formatInitiative(
  row: InitiativeRow,
  projectIds: string[],
  progress: Map<string, { done: number; total: number }>,
): Initiative {
  const totals = projectIds.reduce(
    (sum, projectId) => {
      const entry = progress.get(projectId);

      return entry ? { done: sum.done + entry.done, total: sum.total + entry.total } : sum;
    },
    { done: 0, total: 0 },
  );

  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    description: row.description,
    status: row.status,
    targetDate: row.target_date,
    ownerTeammateId: row.owner_teammate_id,
    projectIds,
    progress: totals,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listInitiatives(
  context: ServiceContext,
  workspaceId: string,
): Promise<InitiativeListResponse> {
  const { workspace } = await requireWorkspaceAccess(context, workspaceId);
  const [rows, projects, progressRows] = await Promise.all([
    context.repositories.get(InitiativeRepository).listForWorkspace(workspaceId),
    context.repositories.get(WorkspaceRepository).listProjects(workspaceId),
    context.repositories.get(InitiativeRepository).summariseProgress(workspaceId),
  ]);
  const progress = new Map(
    progressRows.map((row) => [row.project_id, { done: row.done, total: row.total }]),
  );

  return {
    mission: workspace.mission ?? "",
    initiatives: rows.map((row) =>
      formatInitiative(
        row,
        projects.filter((project) => project.initiative_id === row.id).map((project) => project.id),
        progress,
      ),
    ),
    unalignedProjectIds: projects
      .filter(
        (project) =>
          !project.initiative_id || !rows.some((row) => row.id === project.initiative_id),
      )
      .filter((project) => project.id !== workspace.setup_project_id)
      .map((project) => project.id),
  };
}

async function readInitiative(context: ServiceContext, workspaceId: string, initiativeId: string) {
  const list = await listInitiatives(context, workspaceId);
  const initiative = list.initiatives.find((candidate) => candidate.id === initiativeId);

  if (!initiative) {
    throw new AssistantError("Initiative not found", ErrorType.NOT_FOUND, 404);
  }

  return initiative;
}

export async function createInitiative(
  context: ServiceContext,
  workspaceId: string,
  input: CreateInitiativeInput,
): Promise<Initiative> {
  const user = context.requireUser();

  await requireWorkspaceAccess(context, workspaceId, ["owner", "admin"]);
  const row = await context.repositories.get(InitiativeRepository).create({
    workspaceId,
    name: input.name,
    description: input.description,
    status: input.status,
    targetDate: input.targetDate,
    ownerTeammateId: input.ownerTeammateId,
  });

  if (input.projectIds.length > 0) {
    await context.repositories
      .get(InitiativeRepository)
      .setProjects(workspaceId, row.id, input.projectIds);
  }

  await context.repositories.get(AuditRepository).createRecord({
    workspaceId,
    actorUserId: user.id,
    action: "workspace.initiative.created",
    targetType: "initiative",
    targetId: row.id,
  });

  return readInitiative(context, workspaceId, row.id);
}

export async function updateInitiative(
  context: ServiceContext,
  workspaceId: string,
  initiativeId: string,
  input: UpdateInitiativeInput,
): Promise<Initiative> {
  await requireWorkspaceAccess(context, workspaceId, ["owner", "admin"]);
  const existing = await context.repositories.get(InitiativeRepository).getById(initiativeId);

  if (!existing || existing.workspace_id !== workspaceId) {
    throw new AssistantError("Initiative not found", ErrorType.NOT_FOUND, 404);
  }

  await context.repositories.get(InitiativeRepository).update(initiativeId, {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.targetDate !== undefined ? { target_date: input.targetDate } : {}),
    ...(input.ownerTeammateId !== undefined ? { owner_teammate_id: input.ownerTeammateId } : {}),
  });

  if (input.projectIds) {
    await context.repositories
      .get(InitiativeRepository)
      .setProjects(workspaceId, initiativeId, input.projectIds);
  }

  return readInitiative(context, workspaceId, initiativeId);
}

export async function deleteInitiative(
  context: ServiceContext,
  workspaceId: string,
  initiativeId: string,
): Promise<void> {
  await requireWorkspaceAccess(context, workspaceId, ["owner", "admin"]);
  const existing = await context.repositories.get(InitiativeRepository).getById(initiativeId);

  if (!existing || existing.workspace_id !== workspaceId) {
    throw new AssistantError("Initiative not found", ErrorType.NOT_FOUND, 404);
  }

  await context.repositories.get(InitiativeRepository).delete(initiativeId);
}
