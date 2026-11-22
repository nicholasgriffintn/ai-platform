import { RECIPE_CONNECTOR_CONNECTION_KIND } from "@ngriffin_uk/polychat-ai-integrations";
import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { hasProEntitlement } from "@ngriffin_uk/polychat-library-policy";
import {
  CAPABILITY_DISCOVERY_TOOL_NAME,
  recipeConnectorProviderSchema,
} from "@ngriffin_uk/polychat-schemas";
import { readRecord } from "@ngriffin_uk/polychat-utility-core";

import type { Repositories } from "~/infrastructure/database/repositories";
import {
  buildCapabilityMap,
  type CapabilityMap,
} from "~/modules/assistant-capabilities/domain/capability-map";
import { getRecipeConnectorProviderConfig } from "~/modules/connectors/application/connector-adapters";
import { ProviderConnectionRepository } from "~/modules/connectors/infrastructure/ProviderConnectionRepository";
import { resolveEnabledFunctionToolNames } from "~/modules/tools/application/availability";
import { listFunctionToolDefinitions } from "~/modules/tools/application/catalogue";
import { PermissionChecker } from "~/modules/tools/application/permissions";
import { getToolCategory } from "~/modules/tools/application/toolCategories";
import type { IEnv, IUser } from "~/types";

const logger = getLogger({ prefix: "assistant-capabilities/capability-map" });
const permissionChecker = new PermissionChecker();
const UNCATEGORISED = "Other";

export interface CapabilityMapRequest {
  env: IEnv;
  repositories: Repositories;
  user?: IUser;
  mode?: string;
  requestedToolNames?: readonly string[];
  projectTools?: readonly string[];
  projectConnectorProviders?: readonly string[];
  settingsDisabledTools?: readonly string[];
}

function hasRequiredEnv(env: IEnv, requiredEnv: readonly string[] | undefined): boolean {
  const values = readRecord(env);

  return (requiredEnv ?? []).every((key) => Boolean(values[key]));
}

function listDiscoverableTools(
  request: Omit<CapabilityMapRequest, "repositories">,
  enabled: ReadonlySet<string>,
) {
  const { env, user, mode, projectTools, settingsDisabledTools } = request;
  const isPro = hasProEntitlement(user);

  return listFunctionToolDefinitions()
    .filter((tool) => !enabled.has(tool.name) && !tool.system)
    .filter((tool) => tool.type !== "premium" || isPro)
    .filter((tool) => !projectTools || projectTools.includes(tool.name))
    .filter((tool) => hasRequiredEnv(env, tool.requiredEnv))
    .filter(
      (tool) =>
        permissionChecker.checkToolActivation({
          toolName: tool.name,
          mode,
          user,
          toolType: tool.type,
          toolPermissions: tool.permissions,
          settingsDisabledTools,
        }).allowed,
    )
    .map((tool) => ({
      name: tool.name,
      category: getToolCategory(tool.name),
      hint: tool.capabilityHint,
    }))
    .filter((tool) => tool.category !== UNCATEGORISED);
}

async function listConnectedApps(request: CapabilityMapRequest): Promise<string[]> {
  const userId = request.user?.id;

  if (!userId) {
    return [];
  }

  const connections = await request.repositories
    .get(ProviderConnectionRepository)
    .listConnections(userId);

  return connections.flatMap((connection) => {
    const provider = recipeConnectorProviderSchema.safeParse(connection.provider);
    const inScope =
      !request.projectConnectorProviders ||
      request.projectConnectorProviders.includes(connection.provider);

    if (
      !provider.success ||
      !inScope ||
      connection.status !== "connected" ||
      connection.kind !== RECIPE_CONNECTOR_CONNECTION_KIND
    ) {
      return [];
    }

    return getRecipeConnectorProviderConfig(provider.data)?.name ?? [];
  });
}

export function buildRequestCapabilityMap(
  request: Omit<CapabilityMapRequest, "repositories">,
  connectedApps: readonly string[],
): CapabilityMap | null {
  const enabled = resolveEnabledFunctionToolNames(request.requestedToolNames, request.user);

  if (!enabled.has(CAPABILITY_DISCOVERY_TOOL_NAME)) {
    return null;
  }

  return buildCapabilityMap({
    tools: listDiscoverableTools(request, enabled),
    connectedApps,
  });
}

export async function resolveCapabilityMap(
  request: CapabilityMapRequest,
): Promise<CapabilityMap | null> {
  const enabled = resolveEnabledFunctionToolNames(request.requestedToolNames, request.user);

  if (!enabled.has(CAPABILITY_DISCOVERY_TOOL_NAME)) {
    return null;
  }

  try {
    return buildRequestCapabilityMap(request, await listConnectedApps(request));
  } catch (error) {
    logger.warn("Could not build the capability map", { error });

    return null;
  }
}
