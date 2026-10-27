import type { WorkActor } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import {
  personCaller,
  teammateCaller,
  type WorkCaller,
} from "~/modules/project-tasks/application/work";
import { requireTeammateContext } from "~/modules/teammates/application/contexts";
import {
  listActiveWorkspaceTeammates,
  listWorkspaceTeamDirectory,
} from "~/modules/teammates/application/directory";
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
  const teammateContext = contextId ? await requireTeammateContext(context, contextId) : null;

  return {
    context,
    projectId,
    workspaceId: project.workspace_id,
    caller: teammateContext
      ? await teammateCaller(context, teammateContext.teammateId)
      : personCaller(context),
  };
}

function matchesName(candidate: { name: string }, value: string): boolean {
  const name = candidate.name.toLowerCase();

  return name === value || name.split(/\s+/)[0] === value;
}

export async function resolveWorkReport(scope: WorkToolScope, reference: unknown): Promise<string> {
  const value = typeof reference === "string" ? reference.trim().toLowerCase() : "";
  const team = await listWorkspaceTeamDirectory(scope.context, scope.workspaceId);
  const teammate = team.find(
    (candidate) =>
      (candidate.status === "active" || candidate.status === "paused") &&
      (candidate.teammateId.toLowerCase() === value || matchesName(candidate, value)),
  );

  if (!teammate) {
    throw new Error(`No teammate called "${value}" is on this team. Check the name.`);
  }

  return teammate.teammateId;
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

  const teammates = await listActiveWorkspaceTeammates(scope.context, scope.workspaceId);
  const teammate = teammates.find(
    (candidate) => candidate.teammateId.toLowerCase() === value || matchesName(candidate, value),
  );

  if (teammate) {
    return { type: "teammate", id: teammate.teammateId };
  }

  const members = await scope.context.repositories
    .get(WorkspaceRepository)
    .listMembers(scope.workspaceId);
  const member = members.find(
    (candidate) =>
      candidate.email.toLowerCase() === value ||
      (candidate.name ? matchesName({ name: candidate.name }, value) : false),
  );

  if (member) {
    return { type: "person", userId: member.user_id };
  }

  throw new Error(
    `Nobody called "${value}" is on this team. Check the name, or propose_hire if the team lacks the skill.`,
  );
}
