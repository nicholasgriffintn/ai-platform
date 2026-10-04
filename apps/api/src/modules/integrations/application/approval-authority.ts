import { authorise } from "@ngriffin_uk/polychat-library-policy";

import {
  rejectConnectorApprovalAuthority,
  type ResolveConnectorApprovalAuthority,
} from "~/modules/apps/application/connectors/connector-approval-authority";

import { requireIntegrationExecutionAuthority } from "./execution-authority";

export const resolveNativeMcpApprovalAuthority: ResolveConnectorApprovalAuthority = async (
  params,
) => {
  if (
    params.approval.recipeId ||
    params.approval.installationId ||
    params.approval.channel !== "web" ||
    params.call.sessionId
  ) {
    rejectConnectorApprovalAuthority();
  }

  const authority = await requireIntegrationExecutionAuthority({
    context: params.context,
    userId: params.userId,
    definitionId: params.approval.provider,
    projectId: params.approval.projectId,
    teammateContextId: params.approval.teammateContextId,
  });

  if (
    !authorise("grant.revision", {
      connectionId: authority.connectedAccountId,
      approvedConnectionId: params.approval.connectedAccountId,
      revision: authority.authorityRevision,
      approvedRevision: params.approval.authorityRevision,
      operations: authority.operations,
      operation: params.approval.operation,
    }).allowed
  ) {
    rejectConnectorApprovalAuthority();
  }

  return {
    arguments: params.call.params ?? {},
    requestOptions: {},
    projectId: params.approval.projectId,
    teammateContextId: params.approval.teammateContextId,
  };
};
