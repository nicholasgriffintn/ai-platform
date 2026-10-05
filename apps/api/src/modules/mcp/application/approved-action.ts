import {
  nativeMcpCallSchema,
  teammateRunConfigurationSchema,
  type NativeMcpCall,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import {
  rejectConnectorApprovalAuthority,
  type ConnectorApprovalExecutionAuthority,
} from "~/modules/apps/application/connectors/connector-approval-authority";
import type { ConnectorOperationApprovalRecord } from "~/modules/apps/infrastructure/ConnectorOperationApprovalRepository";

import { requireMcpCall } from "./scope";

export async function resolveMcpApprovalAuthority(params: {
  approval: ConnectorOperationApprovalRecord;
  call: NativeMcpCall;
  context: ServiceContext;
  userId: number;
}): Promise<ConnectorApprovalExecutionAuthority> {
  const { approval, context } = params;
  const call = nativeMcpCallSchema.parse(params.call);
  const run = await context.repositories.conversationRuns.getById(approval.runId);

  if (!run || approval.channel !== run.trigger) {
    rejectConnectorApprovalAuthority();
  }

  const configuration = teammateRunConfigurationSchema.safeParse(run?.resolvedConfiguration);

  if (approval.teammateContextId && !configuration.success) {
    rejectConnectorApprovalAuthority();
  }

  const scope = {
    projectId: approval.projectId ?? undefined,
    teammateContextId: approval.teammateContextId ?? undefined,
    admittedServerIds: configuration.success
      ? configuration.data.mcpServers.map((server) => server.id)
      : undefined,
  };
  const authority = await requireMcpCall(context, call, scope);

  if (
    context.requireUser().id !== params.userId ||
    authority.tool.access !== "write" ||
    approval.connectedAccountId !== authority.connection.id ||
    approval.authorityRevision !== authority.connection.revision
  ) {
    rejectConnectorApprovalAuthority();
  }

  return {
    arguments: call,
    requestOptions: {},
    projectId: scope.projectId,
    teammateContextId: scope.teammateContextId,
  };
}
