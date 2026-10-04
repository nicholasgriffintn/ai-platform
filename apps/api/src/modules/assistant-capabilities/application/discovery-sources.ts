import { hasProEntitlement, ownsResource } from "@ngriffin_uk/polychat-library-policy";
import type {
  AssistantRecipe,
  RecipeConnectorManifest,
  RecipeInstallation,
  IntegrationDefinition,
} from "@ngriffin_uk/polychat-schemas";
import {
  CAPABILITY_DISCOVERY_TOOL_NAME,
  teammateRunConfigurationSchema,
} from "@ngriffin_uk/polychat-schemas";

import { listRecipeConnectors } from "~/modules/apps/application/connectors";
import { listAssistantRecipes, listRecipeInstallations } from "~/modules/apps/application/recipes";
import type {
  CapabilityDiscoverySources,
  DiscoverableFunctionTool,
} from "~/modules/assistant-capabilities/application/discovery";
import { resolveEnabledFunctionToolNames } from "~/modules/functions/application/availability";
import { listFunctionToolDefinitions } from "~/modules/functions/application/definitions";
import { INTERNAL_FUNCTION_TOOLS } from "~/modules/functions/application/internal-tools";
import { PermissionChecker } from "~/modules/functions/application/permissions";
import {
  listDiscoverableNativeIntegrations,
  scopeNativeIntegrationDiscoveryToTeammate,
} from "~/modules/integrations/application/catalogue";
import { formatFunctionName } from "~/modules/tools/application/functions";
import { requireProjectAccess } from "~/modules/workspaces/application/access";
import { resolveProjectTools } from "~/modules/workspaces/application/projectTools";
import type { IRequest } from "~/types";

interface ProjectCapabilityReference {
  kind: string;
  capability_id: string;
  excluded?: boolean | number;
}

const permissionChecker = new PermissionChecker();

export function scopeCapabilityDiscoverySourcesToProject(params: {
  connectors: readonly RecipeConnectorManifest[];
  enabledToolIds: ReadonlySet<string>;
  recipes: readonly AssistantRecipe[];
  references: readonly ProjectCapabilityReference[];
  tools: readonly DiscoverableFunctionTool[];
}): Pick<CapabilityDiscoverySources, "connectors" | "recipes" | "tools"> {
  const recipeIds = new Set(
    params.references
      .filter((capability) => capability.kind === "recipe" && !capability.excluded)
      .map((capability) => capability.capability_id),
  );
  const recipes = params.recipes.filter((recipe) => recipeIds.has(recipe.id));
  const connectorIds = new Set([
    ...params.references
      .filter((reference) => reference.kind === "connector" && !reference.excluded)
      .map((reference) => reference.capability_id),
    ...recipes.flatMap((recipe) =>
      recipe.integrations
        .filter((integration) => integration.requiresConnection)
        .map((integration) => integration.providerId),
    ),
  ]);

  return {
    recipes,
    connectors: params.connectors.filter((connector) => connectorIds.has(connector.id)),
    tools: params.tools.filter((tool) => params.enabledToolIds.has(tool.id)),
  };
}

export async function loadCapabilityDiscoverySources(
  request: IRequest,
): Promise<CapabilityDiscoverySources> {
  const user = request.user;
  const context = request.context;
  const mode = request.request?.tool_policy_mode || request.request?.mode || request.mode;
  const catalogue = listFunctionToolDefinitions().map((tool) => ({
    tool,
    activation: permissionChecker.checkToolAccess({
      toolName: tool.name,
      mode,
      user,
      toolType: tool.type,
      toolPermissions: tool.permissions,
      requireApprovalFor: request.request?.require_approval_for,
      enforceModePolicy: request.request?.enforce_mode_tool_policy,
    }),
  }));
  const activatableToolIds = new Set(
    catalogue.filter((entry) => entry.activation.allowed).map((entry) => entry.tool.name),
  );
  let tools: DiscoverableFunctionTool[] = catalogue
    .filter(
      ({ tool }) =>
        tool.name !== CAPABILITY_DISCOVERY_TOOL_NAME && !INTERNAL_FUNCTION_TOOLS.has(tool.name),
    )
    .map(({ tool, activation }) => ({
      id: tool.name,
      name: formatFunctionName(tool.name),
      description: tool.description,
      type: tool.type,
      activation: {
        allowed: activation.allowed,
        ...(activation.reason ? { reason: activation.reason } : {}),
      },
    }));
  let recipes: AssistantRecipe[] = [];
  let connectors: RecipeConnectorManifest[] = [];
  let installations: RecipeInstallation[] = [];
  let integrations: IntegrationDefinition[] = [];

  if (user?.id && context) {
    const projectId =
      request.memoryScope?.type === "project" ? request.memoryScope.projectId : undefined;

    if (projectId) {
      await requireProjectAccess(context, projectId);
    }

    const connectorList = await listRecipeConnectors({
      context,
      userId: user.id,
      requestUrl: request.app_url,
    });

    if (hasProEntitlement(user)) {
      integrations = await listDiscoverableNativeIntegrations(context, projectId);
      if (request.request?.teammate_context_id) {
        const configuration = teammateRunConfigurationSchema.safeParse(
          request.request.resolved_configuration,
        );

        integrations =
          request.request.resolved_configuration !== undefined && !configuration.success
            ? []
            : await scopeNativeIntegrationDiscoveryToTeammate({
                context,
                integrations,
                projectId,
                teammateContextId: request.request.teammate_context_id,
                ...(configuration.success
                  ? { admittedGrants: configuration.data.connectionGrants }
                  : {}),
              });
      }
    }

    const [recipeList, installationList] = await Promise.all([
      listAssistantRecipes({
        context,
        userId: user.id,
        requestUrl: request.app_url,
        connectors: connectorList.connectors,
      }),
      listRecipeInstallations({
        context,
        userId: user.id,
        ...(projectId ? { projectId } : {}),
      }),
    ]);

    recipes = recipeList.recipes;
    connectors = connectorList.connectors;
    installations = installationList.installations.filter((installation) =>
      ownsResource(user.id, installation.userId),
    );

    if (projectId) {
      const capabilities = await context.repositories.workspaces.listProjectCapabilities(projectId);
      const projectSources = scopeCapabilityDiscoverySourcesToProject({
        connectors,
        enabledToolIds: new Set(resolveProjectTools(capabilities).enabledTools),
        recipes,
        references: capabilities,
        tools,
      });

      recipes = [...projectSources.recipes];
      connectors = [...projectSources.connectors];
      tools = [...projectSources.tools];
    }
  }

  return {
    activatableToolIds,
    connectors,
    enabledToolIds: resolveEnabledFunctionToolNames(request.request?.enabled_tools, user),
    installations,
    integrations,
    isPro: hasProEntitlement(user),
    isSignedIn: Boolean(user?.id),
    ...(request.memoryScope?.type === "project"
      ? { projectId: request.memoryScope.projectId }
      : {}),
    recipes,
    tools,
  };
}
