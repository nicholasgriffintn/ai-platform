import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import {
  resolveProjectModelGovernance,
  type ApprovedRoute,
} from "~/modules/model-registry/application/enforcement";
import { findModelConfig } from "~/modules/models/application/resolve";
import { resolveChatProjectAccess } from "~/modules/workspaces/application/chatProjectAccess";
import type { CoreChatOptions } from "~/types";

export interface GovernedSelection {
  models: string[];
  provider?: string;
  analyticsProperties?: Record<string, string>;
}

function routeProperties(route: ApprovedRoute): Record<string, string> {
  return {
    "polychat.route_id": route.routeId,
    "polychat.asset_version_id": route.versionId,
  };
}

export async function applyProjectModelGovernance(
  options: Pick<CoreChatOptions, "context" | "completion_id" | "metadata" | "env">,
  selection: { models: string[]; provider?: string; usesModelTier: boolean },
): Promise<GovernedSelection> {
  const context = options.context;
  const access = context ? await resolveChatProjectAccess(context, options) : null;

  if (!context || !access) {
    return { models: selection.models, provider: selection.provider };
  }

  const governance = await resolveProjectModelGovernance(context.repositories, access.project);
  const blocked: string[] = [];
  let primaryRoute: ApprovedRoute | undefined;

  for (const [index, modelId] of selection.models.entries()) {
    const config = await findModelConfig(modelId, options.env, selection.provider);
    const route = config
      ? governance.routeFor({ id: config.id ?? modelId, provider: config.provider })
      : undefined;

    if (index === 0) {
      primaryRoute = route;
    }

    if (!route) {
      blocked.push(modelId);
    }
  }

  if (!governance.enforced || blocked.length === 0) {
    return {
      models: selection.models,
      provider: selection.provider,
      analyticsProperties: primaryRoute ? routeProperties(primaryRoute) : undefined,
    };
  }

  const [fallback] = governance.approved;

  if (selection.usesModelTier && fallback) {
    return {
      models: [fallback.id],
      provider: fallback.provider,
      analyticsProperties: routeProperties(fallback),
    };
  }

  throw new AssistantError(
    `${blocked.join(", ")} ${blocked.length === 1 ? "is" : "are"} not approved for this project. Ask a workspace admin to approve a route under Models.`,
    ErrorType.FORBIDDEN,
    403,
  );
}
