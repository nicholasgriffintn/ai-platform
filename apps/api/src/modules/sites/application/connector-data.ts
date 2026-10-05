import {
  hasProEntitlement,
  ownsResource,
  operationIsGranted,
} from "@ngriffin_uk/polychat-library-policy";
import {
  normaliseSiteIntegrations,
  projectSiteSourceRows,
} from "@ngriffin_uk/polychat-library-sites";
import {
  recipeConnectorProviderSchema,
  type SiteConnectorSnapshotRequest,
  siteConnectorSnapshotRequestSchema,
  type SiteSourceRefreshRequest,
} from "@ngriffin_uk/polychat-schemas";
import { generateId, isRecord } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import {
  hasSensitiveFieldNames,
  redactSensitiveTokens,
} from "@ngriffin_uk/polychat-utility-server/redaction";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { closeComposioConnectorRun } from "~/modules/apps/application/connectors/composio-run";
import { getRecipeConnectorAdapter } from "~/modules/apps/application/connectors/connector-adapters";
import {
  discoverRecipeConnectorTools,
  executeRecipeConnectorOperation,
  getActiveComposioAccountForProvider,
} from "~/modules/apps/application/connectors/operations";
import { requireActiveExecutionRun } from "~/modules/chat-runs/application/execution-authority";
import { createSource, deleteSource } from "~/modules/sources/application/sources";
import { resolveProjectRecipeConnectorScope } from "~/modules/workspaces/application/projectRecipeConnectorScope";

import { requireSiteIntegrationAccess } from "./integration-access";
import { updateSite } from "./records";
import { requireSiteSourceBinding } from "./source-bindings";

export async function refreshSiteConnectorSource(
  context: ServiceContext,
  siteId: string,
  request: SiteSourceRefreshRequest,
) {
  const site = await requireSiteIntegrationAccess(context, siteId, request, true);
  const binding = site.project.dataBindings?.[request.bindingId];

  if (!binding || binding.kind !== "source") {
    throw new AssistantError("Connector source not found", ErrorType.NOT_FOUND, 404);
  }

  const source = await requireSiteSourceBinding(
    context,
    context.requireUser().id,
    binding.sourceId,
    site.projectId,
  );
  const storedConfiguration = isRecord(source.metadata.siteConnector)
    ? source.metadata.siteConnector
    : {};
  const configuration = siteConnectorSnapshotRequestSchema.safeParse({
    ...storedConfiguration,
    projectId: request.projectId,
    expectedRevision: request.expectedRevision,
  });

  if (
    !ownsResource(context.requireUser().id, source.createdByUserId) ||
    !configuration.success ||
    configuration.data.bindingId !== request.bindingId
  ) {
    throw new AssistantError(
      "Only the connector account owner can refresh this source",
      ErrorType.FORBIDDEN,
      403,
    );
  }

  return snapshotSiteConnector(context, siteId, configuration.data);
}

export async function snapshotSiteConnector(
  context: ServiceContext,
  siteId: string,
  request: SiteConnectorSnapshotRequest,
) {
  if (hasSensitiveFieldNames(request.params)) {
    throw new AssistantError(
      "Connector parameters must not include credentials",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  const user = context.requireUser();

  if (!hasProEntitlement(user)) {
    throw new AssistantError("Connector data needs a Pro account", ErrorType.FORBIDDEN, 403);
  }

  const site = await requireSiteIntegrationAccess(context, siteId, request, true);
  const provider = recipeConnectorProviderSchema.parse(request.provider);
  const adapter = getRecipeConnectorAdapter(provider);
  const operation = adapter?.provider.operations.find(
    (candidate) => candidate.id === request.operation,
  );

  if (
    !adapter ||
    adapter.provider.auth.authType !== "composio" ||
    operation?.access !== "read" ||
    operation.destructive
  ) {
    throw new AssistantError(
      "Only supported read operations can supply site data",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  if (!Object.hasOwn(site.project.pages, request.pageId)) {
    throw new AssistantError("Site page not found", ErrorType.NOT_FOUND, 404);
  }

  const checkAuthority = async () => {
    if (!request.projectId) {
      return;
    }

    const capabilities = await context.repositories.workspaces.listProjectCapabilities(
      request.projectId,
    );
    const allowed =
      resolveProjectRecipeConnectorScope(capabilities).operationsByProvider[provider] ?? [];

    if (!operationIsGranted(allowed, operation.id)) {
      throw new AssistantError(
        "The connector operation is not enabled in this project",
        ErrorType.FORBIDDEN,
        403,
      );
    }
  };

  await checkAuthority();
  const proposed = normaliseSiteIntegrations(
    {
      ...site.project,
      dataBindings: {
        ...site.project.dataBindings,
        [request.bindingId]: {
          kind: "source",
          sourceId: "pending",
          pageId: request.pageId,
          statePath: request.statePath,
        },
      },
    },
    site.project,
  );

  if (proposed.issues.length) {
    throw new AssistantError(proposed.issues[0].message, ErrorType.PARAMS_ERROR, 400);
  }

  const completionId = context.connectorRunId;
  let sessionId: string | undefined;

  try {
    await requireActiveExecutionRun(context);
    const discovery = await discoverRecipeConnectorTools({
      context,
      userId: user.id,
      projectId: request.projectId,
      completionId,
      provider,
      useCase: `Read data for ${site.title}`,
      allowedOperations: [operation.id],
      connectedAccountId: request.connectedAccountId,
      requireSelectedAccount: true,
    });

    sessionId = discovery.sessionId;
    const result = await executeRecipeConnectorOperation({
      context,
      userId: user.id,
      scope: { projectId: request.projectId, completionId },
      request: {
        provider,
        operation: operation.id,
        params: request.params,
        sessionId: discovery.sessionId,
      },
    });
    const rows = projectSiteSourceRows(
      redactSensitiveTokens(
        isRecord(result) && Object.hasOwn(result, "data") ? result.data : result,
      ),
      request.resultPath,
      request.fields,
    );

    await requireSiteIntegrationAccess(context, siteId, request, true);
    await requireActiveExecutionRun(context);
    await checkAuthority();
    await getActiveComposioAccountForProvider({
      context,
      userId: user.id,
      provider: adapter.provider,
      connectedAccountId: request.connectedAccountId,
      requireSelectedAccount: true,
    });
    const source = await createSource(context, user.id, {
      projectId: request.projectId,
      kind: "connector",
      title: `${site.title}: ${request.bindingId}`,
      status: "available",
      provider,
      content: JSON.stringify(rows),
      metadata: {
        siteId,
        operation: operation.id,
        refreshedAt: new Date().toISOString(),
        siteConnector: request,
      },
    });

    try {
      return await updateSite({ context, userId: user.id, projectId: request.projectId }, siteId, {
        expectedRevision: request.expectedRevision,
        brief: site.brief,
        plan: site.plan,
        issues: site.issues,
        project: {
          ...site.project,
          dataBindings: {
            ...site.project.dataBindings,
            [request.bindingId]: {
              kind: "source",
              sourceId: source.id,
              pageId: request.pageId,
              statePath: request.statePath,
            },
          },
        },
        turn: {
          id: `data-${generateId()}`,
          role: "edit",
          prompt: `Refreshed ${request.bindingId} from ${adapter.provider.name}`,
          createdAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      await deleteSource(context, user.id, source.id);
      throw error;
    }
  } finally {
    if (sessionId) {
      await closeComposioConnectorRun(context, [sessionId]);
    }
  }
}
