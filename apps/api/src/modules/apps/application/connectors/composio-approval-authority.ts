import { getConnectorProviderConfig } from "@ngriffin_uk/polychat-ai-integrations";
import { authorise } from "@ngriffin_uk/polychat-library-policy";

import type { ComposioConnectorSessionRecord } from "~/modules/apps/infrastructure/ComposioConnectorSessionRepository";
import type { ConnectorOperationApprovalRecord } from "~/modules/apps/infrastructure/ConnectorOperationApprovalRepository";
import { resolveTeammateConnectorAuthority } from "~/modules/teammates/application/connection-authority";

import { buildConnectorApprovalRecipeContext } from "./approval-recipe-context";
import {
  rejectConnectorApprovalAuthority,
  type ResolveConnectorApprovalAuthority,
  type StoredConnectorOperationCall,
} from "./connector-approval-authority";
import { encodeConnectorReplayScope } from "./connector-replay-scope";

function requireSessionMatchesApproval(params: {
  approval: ConnectorOperationApprovalRecord;
  call: StoredConnectorOperationCall;
  userId: number;
  session: ComposioConnectorSessionRecord | null;
}): ComposioConnectorSessionRecord {
  const { approval, session, call, userId } = params;

  if (!session) {
    rejectConnectorApprovalAuthority();
  }

  const isAuthorised = authorise("connector.replay", {
    sessionId: session.id,
    requestSessionId: call.sessionId ?? "",
    kind: session.kind,
    actorId: String(userId),
    ownerId: String(session.userId),
    sessionScope: encodeConnectorReplayScope(session),
    approvalScope: encodeConnectorReplayScope(approval),
    operations: [...session.allowedOperationIds],
    operation: approval.operation,
    hasAuthConfig: Boolean(session.authConfigId),
    hasConnectedAccount: Boolean(session.connectedAccountId),
    state: session.state,
    expiresAt: new Date(session.expiresAt).getTime(),
    now: Date.now(),
  }).allowed;

  if (!isAuthorised) {
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
      !authorise("grant.revision", {
        connectionId: authority.connectedAccountId ?? "",
        approvedConnectionId: session.connectedAccountId ?? "",
        revision: authority.grantRevision,
        approvedRevision: params.approval.authorityRevision,
        operations: authority.allowedOperations,
        operation: params.approval.operation,
      }).allowed
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
