import {
  integrationGrantSchema,
  type IntegrationDefinition,
  type TeammateRunConfiguration,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { parseJsonRecord } from "@ngriffin_uk/polychat-utility-server/json";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import {
  requireProjectAccess,
  requireWorkspaceAccess,
  requireWorkAccess,
} from "~/modules/workspaces/application/access";

import type { StoredIntegrationDefinition } from "../infrastructure/IntegrationDefinitionRepository";
import { requireIntegrationDefinition } from "./access";
import { readIntegrationConnection } from "./connections";
import { requireIntegrationExecutionAuthority } from "./execution-authority";

export async function scopeNativeIntegrationDiscoveryToTeammate(params: {
  context: ServiceContext;
  integrations: IntegrationDefinition[];
  projectId?: string;
  teammateContextId: string;
  admittedGrants?: TeammateRunConfiguration["connectionGrants"];
}): Promise<IntegrationDefinition[]> {
  const results = await Promise.all(
    params.integrations.map(async (definition) => {
      try {
        const authority = await requireIntegrationExecutionAuthority({
          context: params.context,
          userId: params.context.requireUser().id,
          definitionId: definition.id,
          projectId: params.projectId,
          teammateContextId: params.teammateContextId,
          admittedGrants: params.admittedGrants,
        });

        return {
          ...definition,
          revision: authority.definition.revision,
          connected: true,
          snapshot: {
            ...authority.definition.snapshot,
            tools: authority.definition.snapshot.tools.filter((tool) =>
              authority.operations.includes(tool.name),
            ),
          },
        };
      } catch (error) {
        if (error instanceof AssistantError && [401, 403, 404].includes(error.statusCode)) {
          return null;
        }

        throw error;
      }
    }),
  );

  return results.flatMap((definition) => (definition ? [definition] : []));
}

export async function integrationDefinitionView(
  context: ServiceContext,
  definition: StoredIntegrationDefinition,
): Promise<IntegrationDefinition> {
  const user = context.requireUser();
  const { canManage } = await requireIntegrationDefinition(context, definition.id);
  const connection = await readIntegrationConnection({
    context,
    userId: user.id,
    definitionId: definition.id,
    snapshot: definition.snapshot,
  });

  return {
    id: definition.id,
    name: definition.name,
    description: definition.description,
    workspaceId: definition.workspaceId,
    revision: definition.revision,
    snapshot: definition.snapshot,
    revoked: definition.revoked,
    createdAt: definition.createdAt,
    canManage,
    connected: Boolean(connection),
  };
}

export async function listNativeIntegrations(
  context: ServiceContext,
  scope: { workspaceId?: string; projectId?: string } = {},
): Promise<{ integrations: IntegrationDefinition[] }> {
  const user = requireWorkAccess(context);
  let workspaceId = scope.workspaceId;

  if (scope.projectId) {
    const { project } = await requireProjectAccess(context, scope.projectId);

    if (workspaceId && workspaceId !== project.workspace_id) {
      throw new AssistantError(
        "Project does not belong to this workspace",
        ErrorType.NOT_FOUND,
        404,
      );
    }

    workspaceId = project.workspace_id;
  }

  if (workspaceId) {
    await requireWorkspaceAccess(context, workspaceId);
  }

  const definitions = await context.repositories.integrationDefinitions.list(
    workspaceId ? { workspaceId } : { userId: user.id },
  );

  return {
    integrations: await Promise.all(
      definitions.map((definition) => integrationDefinitionView(context, definition)),
    ),
  };
}

export async function listDiscoverableNativeIntegrations(
  context: ServiceContext,
  projectId?: string,
): Promise<IntegrationDefinition[]> {
  const { integrations } = await listNativeIntegrations(context, { projectId });

  if (!projectId) {
    return integrations;
  }

  const capabilities = await context.repositories.workspaces.listProjectCapabilities(projectId);
  const scoped = await Promise.all(
    integrations.map(async (definition) => {
      const capability = capabilities.find(
        (candidate) =>
          candidate.kind === "integration" &&
          candidate.capability_id === definition.id &&
          !candidate.excluded,
      );
      const grant = integrationGrantSchema.safeParse(parseJsonRecord(capability?.configuration));

      if (!grant.success || grant.data.revision > definition.revision) {
        return null;
      }

      const snapshot = await context.repositories.integrationDefinitions.getSnapshot(
        definition.id,
        grant.data.revision,
      );

      return snapshot
        ? {
            ...definition,
            revision: grant.data.revision,
            snapshot: {
              ...snapshot,
              tools: snapshot.tools.filter((tool) => grant.data.operations.includes(tool.name)),
            },
          }
        : null;
    }),
  );

  return scoped.flatMap((definition) => (definition ? [definition] : []));
}
