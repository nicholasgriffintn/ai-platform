import {
  sandboxEnvironmentVariableInputSchema,
  sandboxEnvironmentVariableNameSchema,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { AuditRepository } from "~/modules/audit/infrastructure/AuditRepository";
import { ProjectEnvironmentVariableRepository } from "~/modules/workspaces/infrastructure/ProjectEnvironmentVariableRepository";

import { requireProjectAccess } from "./access";
import { invalidateProjectEnvironmentCacheForConfiguration } from "./environment-cache";

export async function listProjectEnvironmentVariables(context: ServiceContext, projectId: string) {
  await requireProjectAccess(context, projectId);

  return {
    variables: await context.repositories.get(ProjectEnvironmentVariableRepository).list(projectId),
  };
}

export async function setProjectEnvironmentVariable(
  context: ServiceContext,
  projectId: string,
  input: unknown,
) {
  const user = context.requireUser();
  const { project } = await requireProjectAccess(context, projectId, ["owner", "admin"]);
  const variable = sandboxEnvironmentVariableInputSchema.parse(input);

  await context.repositories
    .get(ProjectEnvironmentVariableRepository)
    .set(projectId, variable.name, variable.value);
  await invalidateProjectEnvironmentCacheForConfiguration(context, project);
  await context.repositories.get(AuditRepository).createRecord({
    workspaceId: project.workspace_id,
    actorUserId: user.id,
    action: "project.updated",
    targetType: "project",
    targetId: projectId,
    metadata: { fields: ["environmentVariables"], variable: variable.name },
  });

  return listProjectEnvironmentVariables(context, projectId);
}

export async function clearProjectEnvironmentVariable(
  context: ServiceContext,
  projectId: string,
  name: string,
) {
  const user = context.requireUser();
  const { project } = await requireProjectAccess(context, projectId, ["owner", "admin"]);
  const variableName = sandboxEnvironmentVariableNameSchema.parse(name);

  await context.repositories
    .get(ProjectEnvironmentVariableRepository)
    .clear(projectId, variableName);
  await invalidateProjectEnvironmentCacheForConfiguration(context, project);
  await context.repositories.get(AuditRepository).createRecord({
    workspaceId: project.workspace_id,
    actorUserId: user.id,
    action: "project.updated",
    targetType: "project",
    targetId: projectId,
    metadata: { fields: ["environmentVariables"], variable: variableName },
  });

  return listProjectEnvironmentVariables(context, projectId);
}
