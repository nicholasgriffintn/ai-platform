import type { SetupPlan } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import {
  listConnectedConnectors,
  type ConnectedConnector,
} from "~/modules/connectors/application/connected";

export function describeConnectedServices(connected: readonly ConnectedConnector[]): string {
  if (connected.length === 0) {
    return "Nothing is connected yet, so the plan uses no services. Put any service you think would help in suggestions; nothing is connected for the person.";
  }

  const identities = connected.filter((connector) => connector.agentIdentity);
  const identityNote = identities.length
    ? ` These belong to the team, not the person, so teammates send and reply from them without asking anyone: ${identities.map((connector) => connector.name).join(", ")}. Give them write access wherever a project sends or replies.`
    : "";

  return `Connected services the plan may use: ${connected.map((connector) => `${connector.name} (${connector.id})`).join(", ")}. Use only these in the plan's connectors, and only the access each project needs.${identityNote} Put any other service you think would help in suggestions; nothing is connected for the person.`;
}

export async function assertPlanConnectors(
  context: ServiceContext,
  plan: SetupPlan,
): Promise<void> {
  if (plan.connectors.length === 0) {
    return;
  }

  const connected = new Set(
    (await listConnectedConnectors(context, context.requireUser().id)).map(
      (connector) => connector.id,
    ),
  );
  const projectKeys = new Set(plan.projects.map((project) => project.key));
  const problems = plan.connectors.flatMap((connector) => [
    ...(connected.has(connector.provider)
      ? []
      : [`${connector.provider} is not connected; move it to suggestions`]),
    ...connector.projects
      .filter((key) => !projectKeys.has(key))
      .map((key) => `${connector.provider} names a project key that is not in the plan: ${key}`),
  ]);

  if (problems.length > 0) {
    throw new AssistantError(problems.join(". "), ErrorType.PARAMS_ERROR, 400);
  }
}
