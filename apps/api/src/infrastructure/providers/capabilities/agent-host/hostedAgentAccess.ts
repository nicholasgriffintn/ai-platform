import { hasProEntitlement } from "@ngriffin_uk/polychat-library-policy";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { IUser } from "~/types";

import { AgentHostClient } from "./AgentHostClient";
import type { AgentHostSpec } from "./agentHostSpec";

export function requireHostedAgentAccess(
  context: ServiceContext | undefined,
  spec: AgentHostSpec,
): {
  context: ServiceContext;
  user: IUser;
  client: AgentHostClient;
} {
  const user = context?.user;

  if (!context || !user?.id) {
    throw new AssistantError(
      `Sign in to use ${spec.displayName}`,
      ErrorType.AUTHENTICATION_ERROR,
      401,
    );
  }

  if (!hasProEntitlement(user)) {
    throw new AssistantError(
      `Hosted ${spec.displayName} is available on paid plans`,
      ErrorType.AUTHORISATION_ERROR,
      403,
    );
  }

  if (!context.env.AGENT_WORKER) {
    throw new AssistantError(
      "Hosted agents are not configured on this server",
      ErrorType.CONFIGURATION_ERROR,
    );
  }

  return { context, user, client: new AgentHostClient(context.env.AGENT_WORKER) };
}
