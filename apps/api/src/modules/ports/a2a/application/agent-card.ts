import {
  A2A_PROTOCOL_VERSION,
  type A2aAgentCard,
  type TeammateSummary,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { listScopedTeammateSummaries } from "~/modules/teammates/application/listing";

const A2A_CARD_VERSION = "1.0.0";

export function teammateA2aUrl(origin: string, teammateId: string): string {
  return `${origin}/a2a/teammates/${encodeURIComponent(teammateId)}/rpc`;
}

export function buildTeammateAgentCard(teammate: TeammateSummary, origin: string): A2aAgentCard {
  return {
    protocolVersion: A2A_PROTOCOL_VERSION,
    name: teammate.name,
    description: teammate.description || `${teammate.name}, a Polychat teammate.`,
    url: teammateA2aUrl(origin, teammate.id),
    preferredTransport: "JSONRPC",
    version: A2A_CARD_VERSION,
    ...(teammate.avatarUrl ? { iconUrl: teammate.avatarUrl } : {}),
    provider: { organization: "Polychat", url: origin },
    capabilities: { streaming: true, pushNotifications: false, stateTransitionHistory: false },
    defaultInputModes: ["text/plain", "application/json"],
    defaultOutputModes: ["text/plain"],
    skills: [
      {
        id: teammate.id,
        name: teammate.name,
        description:
          "Works on the request in its own Polychat conversation with its tools, and asks its owner in Polychat before anything that sends, spends or deletes.",
        tags: [teammate.kind],
      },
    ],
    securitySchemes: {
      polychatApiKey: {
        type: "http",
        scheme: "bearer",
        description: "A Polychat API key belonging to the teammate's owner.",
      },
    },
    security: [{ polychatApiKey: [] }],
  };
}

export async function requireA2aTeammate(
  context: ServiceContext,
  teammateId: string,
): Promise<TeammateSummary> {
  const teammates = await listScopedTeammateSummaries(context, context.requireUser().id);
  const teammate = teammates.find((candidate) => candidate.id === teammateId);

  if (!teammate) {
    throw new AssistantError("Teammate not found", ErrorType.NOT_FOUND, 404);
  }

  return teammate;
}
