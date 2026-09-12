import { getConnectorProviderConfig } from "~/lib/providers/capabilities/connectors";
import type { ComposioConnectorSessionRecord } from "~/repositories/ComposioConnectorSessionRepository";
import type { ConnectorOperationApprovalRecord } from "~/repositories/ConnectorOperationApprovalRepository";
import { resolveTeammateConnectorAuthority } from "~/services/teammates/connection-authority";

import { buildConnectorApprovalRecipeContext } from "./approval-recipe-context";
import {
  rejectConnectorApprovalAuthority,
  type ResolveConnectorApprovalAuthority,
  type StoredConnectorOperationCall,
} from "./connector-approval-authority";

function requireSessionMatchesApproval(params: {
  approval: ConnectorOperationApprovalRecord;
  call: StoredConnectorOperationCall;
  userId: number;
  session: ComposioConnectorSessionRecord | null;
}): ComposioConnectorSessionRecord {
  const { approval, session, call, userId } = params;

  if (
    !session ||
    session.id !== call.sessionId ||
    session.kind !== "tool" ||
    session.userId !== userId ||
    session.provider !== approval.provider ||
    session.runId !== approval.runId ||
    session.completionId !== approval.completionId ||
    session.connectedAccountId !== approval.connectedAccountId ||
    (session.recipeId ?? undefined) !== approval.recipeId ||
    (session.installationId ?? undefined) !== approval.installationId ||
    (session.projectId ?? undefined) !== approval.projectId ||
    (session.teammateContextId ?? undefined) !== approval.teammateContextId ||
    !session.allowedOperationIds.includes(approval.operation) ||
    !session.authConfigId ||
    !session.connectedAccountId ||
    (session.state !== "active" && session.state !== "claimed") ||
    session.expiresAt <= new Date().toISOString()
  ) {
    rejectConnectorApprovalAuthority();
  }

  return session;
}

export const resolveComposioApprovalAuthority: ResolveConnectorApprovalAuthority = async (
  params,
) => {
  const session = requireSessionMatchesApproval({
    approval: params.approval,
    call: params.call,
    userId: params.userId,
    session: await params.context.repositories.composioConnectorSessions.getById(
      params.call.sessionId ?? "",
    ),
  });
  const provider = getConnectorProviderConfig(params.approval.provider);

  if (!provider || provider.auth.authType !== "composio") {
    rejectConnectorApprovalAuthority();
  }

  if (params.approval.teammateContextId) {
    const authority = await resolveTeammateConnectorAuthority({
      context: params.context,
      contextId: params.approval.teammateContextId,
      userId: params.userId,
      provider: provider.id,
    });

    if (
      authority.connectedAccountId !== session.connectedAccountId ||
      authority.grantRevision !== params.approval.authorityRevision ||
      !authority.allowedOperations.includes(params.approval.operation)
    ) {
      rejectConnectorApprovalAuthority();
    }
  } else if (params.approval.authorityRevision !== 0) {
    rejectConnectorApprovalAuthority();
  }

  const recipeContext = await buildConnectorApprovalRecipeContext({
    context: params.context,
    userId: params.userId,
    channel: params.approval.channel,
    recipeId: session.recipeId ?? undefined,
    installationId: session.installationId ?? undefined,
    projectId: session.projectId ?? undefined,
    teammateContextId: session.teammateContextId ?? undefined,
  });

  return {
    ...recipeContext,
    arguments: {
      ...recipeContext.requestOptions.recipe?.configuration,
      ...params.call.params,
    },
  };
};
