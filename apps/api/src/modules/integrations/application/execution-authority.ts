import { authorise, operationIsGranted, ownsResource } from "@ngriffin_uk/polychat-library-policy";
import {
  integrationGrantSchema,
  type TeammateRunConfiguration,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { parseJsonRecord } from "@ngriffin_uk/polychat-utility-server/json";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { requireProjectTeammate } from "~/modules/teammates/application/access";
import { requireProjectAccess } from "~/modules/workspaces/application/access";

import { requireIntegrationDefinition } from "./access";
import { readIntegrationConnection } from "./connections";

export async function requireIntegrationExecutionAuthority(params: {
  context: ServiceContext;
  userId: number;
  definitionId: string;
  projectId?: string;
  teammateContextId?: string;
  admittedGrants?: TeammateRunConfiguration["connectionGrants"];
}) {
  if (!ownsResource(params.userId, params.context.requireUser().id)) {
    throw new AssistantError(
      "Integration runner does not match the authenticated actor",
      ErrorType.FORBIDDEN,
      403,
    );
  }

  let { definition } = await requireIntegrationDefinition(params.context, params.definitionId);
  let operations = definition.snapshot.tools.map((tool) => tool.name);

  if (params.projectId) {
    const { project } = await requireProjectAccess(params.context, params.projectId);
    const capabilities = await params.context.repositories.workspaces.listProjectCapabilities(
      params.projectId,
    );
    const capability = capabilities.find(
      (candidate) => candidate.kind === "integration" && candidate.capability_id === definition.id,
    );
    const grant = integrationGrantSchema.safeParse(parseJsonRecord(capability?.configuration));

    if (
      !authorise("capability.use", {
        granted: Boolean(capability),
        excluded: Boolean(capability?.excluded),
      }).allowed ||
      !grant.success ||
      definition.workspaceId !== project.workspace_id ||
      grant.data.revision > definition.revision
    ) {
      throw new AssistantError(
        "Review and enable the current integration tools in this project",
        ErrorType.FORBIDDEN,
        403,
      );
    }

    const pinnedSnapshot = await params.context.repositories.integrationDefinitions.getSnapshot(
      definition.id,
      grant.data.revision,
    );

    if (!pinnedSnapshot) {
      throw new AssistantError(
        "The reviewed integration revision is unavailable",
        ErrorType.FORBIDDEN,
        403,
      );
    }

    definition = { ...definition, revision: grant.data.revision, snapshot: pinnedSnapshot };
    operations = pinnedSnapshot.tools
      .map((tool) => tool.name)
      .filter((operation) => operationIsGranted(grant.data.operations, operation));
  } else if (definition.workspaceId) {
    throw new AssistantError(
      "Workspace integrations require an explicit project grant",
      ErrorType.FORBIDDEN,
      403,
    );
  }

  const connection = await readIntegrationConnection({ ...params, snapshot: definition.snapshot });

  if (!connection) {
    throw new AssistantError(
      "Connect your personal integration account before using its tools",
      ErrorType.AUTHORISATION_ERROR,
      403,
    );
  }

  let grantRevision = 0;

  if (params.teammateContextId) {
    const teammateContext = await params.context.repositories.teammateContexts.getById(
      params.teammateContextId,
    );

    if (
      !teammateContext ||
      !ownsResource(params.userId, teammateContext.actorUserId) ||
      teammateContext.status !== "active" ||
      (teammateContext.scope.type === "project"
        ? teammateContext.scope.id !== params.projectId
        : Boolean(params.projectId) || teammateContext.scope.id !== String(params.userId))
    ) {
      throw new AssistantError(
        "Teammate integration scope is unavailable",
        ErrorType.FORBIDDEN,
        403,
      );
    }

    if (params.projectId) {
      await requireProjectTeammate(params.context, params.projectId, teammateContext.teammateId);
    }

    const liveGrants = await params.context.repositories.teammateContexts.listConnectionGrants(
      teammateContext.id,
    );
    const grant = liveGrants.find((candidate) => candidate.connectionId === connection.record.id);
    const admitted = params.admittedGrants?.find(
      (candidate) =>
        candidate.id === grant?.id &&
        candidate.connectionId === grant.connectionId &&
        candidate.revision === grant.revision,
    );

    if (!grant || (params.admittedGrants && !admitted)) {
      throw new AssistantError(
        "Grant this integration account to the teammate before using it",
        ErrorType.FORBIDDEN,
        403,
      );
    }

    operations = operations.filter(
      (operation) =>
        operationIsGranted(grant.allowedOperations, operation) &&
        (!admitted || operationIsGranted(admitted.allowedOperations, operation)),
    );
    grantRevision = grant.revision;
  }

  return {
    definition,
    operations,
    connection,
    authorityRevision: grantRevision,
    connectedAccountId: `${connection.accountId}:${definition.revision}:${definition.snapshot.digest}`,
  };
}
