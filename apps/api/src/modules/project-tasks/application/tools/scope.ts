import type { WorkActor } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import {
  personCaller,
  teammateCaller,
  type WorkCaller,
} from "~/modules/project-tasks/application/work";
import { TeammateContextRepository } from "~/modules/teammates/infrastructure/TeammateContextRepository";
import { TeammateRepository } from "~/modules/teammates/infrastructure/TeammateRepository";
import { WorkspaceTeammateRepository } from "~/modules/teammates/infrastructure/WorkspaceTeammateRepository";
import { resolveRequestProjectId } from "~/modules/tools/application/request-context";
import { WorkspaceRepository } from "~/modules/workspaces/infrastructure/WorkspaceRepository";
import type { IRequest } from "~/types";

export function requireProjectId(request: IRequest): string {
  const projectId = resolveRequestProjectId(request);

  if (!projectId) {
    throw new Error(
      "Project task tools are only available in a project conversation. Ask the person to open the project first.",
    );
  }

  return projectId;
}

export interface WorkToolScope {
  context: ServiceContext;
  projectId: string;
  workspaceId: string;
  caller: WorkCaller;
}

export async function resolveWorkToolScope(request: IRequest): Promise<WorkToolScope> {
  const projectId = requireProjectId(request);
  const context = request.context;

  if (!context) {
    throw new Error("Signed-in project context is required for Work tools");
  }

  const project = await context.repositories.get(WorkspaceRepository).getProject(projectId);

  if (!project) {
    throw new Error("This project is no longer available");
  }

  const contextId = request.request?.teammate_context_id;
  const teammateContext = contextId
    ? await context.repositories.get(TeammateContextRepository).getById(contextId)
    : null;

  return {
    context,
    projectId,
    workspaceId: project.workspace_id,
    caller: teammateContext
      ? await teammateCaller(context, teammateContext.teammateId)
      : personCaller(context),
  };
}

export async function resolveWorkActor(
  scope: WorkToolScope,
  reference: unknown,
): Promise<WorkActor> {
  const value = typeof reference === "string" ? reference.trim().toLowerCase() : "";

  if (!value) {
    throw new Error("Say who this is for: a teammate's name, a person's name or email, or 'me'.");
  }

  if (value === "me" || value === "myself") {
    return { type: "person", userId: scope.context.requireUser().id };
  }

  const team = await scope.context.repositories
    .get(WorkspaceTeammateRepository)
    .listForWorkspace(scope.workspaceId);
  const teammates = await scope.context.repositories
    .get(TeammateRepository)
    .getTeammatesByIds(
      team.filter((member) => member.status === "active").map((member) => member.teammateId),
    );
  const teammate = teammates.find(
    (candidate) =>
      candidate.id.toLowerCase() === value ||
      candidate.name.toLowerCase() === value ||
      candidate.name.toLowerCase().split(/\s+/)[0] === value,
  );

  if (teammate) {
    return { type: "teammate", id: teammate.id };
  }

  const members = await scope.context.repositories
    .get(WorkspaceRepository)
    .listMembers(scope.workspaceId);
  const member = members.find(
    (candidate) =>
      candidate.email.toLowerCase() === value ||
      candidate.name?.toLowerCase() === value ||
      candidate.name?.toLowerCase().split(/\s+/)[0] === value,
  );

  if (member) {
    return { type: "person", userId: member.user_id };
  }

  throw new Error(
    `Nobody called "${value}" is on this team. Check the name, or propose_hire if the team lacks the skill.`,
  );
}

export function readText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
