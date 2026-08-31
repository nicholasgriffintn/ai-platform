import type {
  AssistantRecipe,
  CapabilityDiscoveryItem,
  CapabilityDiscoveryKind,
  CapabilityDiscoveryResult,
  RecipeConnectorManifest,
  RecipeInstallation,
} from "@ngriffin_uk/polychat-schemas";

export interface DiscoverableFunctionTool {
  id: string;
  name: string;
  description: string;
  type: "normal" | "premium" | "byok";
  activation: {
    allowed: boolean;
    reason?: string;
  };
}

export interface CapabilityDiscoverySources {
  /** Function tools the current tool policy would let this turn activate, internal ones included. */
  activatableToolIds: ReadonlySet<string>;
  connectors: readonly RecipeConnectorManifest[];
  enabledToolIds: ReadonlySet<string>;
  installations: readonly RecipeInstallation[];
  isPro: boolean;
  isSignedIn: boolean;
  projectId?: string;
  recipes: readonly AssistantRecipe[];
  tools: readonly DiscoverableFunctionTool[];
}

const RECIPE_TRIGGER_TOOL_NAME = "trigger_recipe";
const CONNECTOR_EXECUTION_TOOL_NAME = "use_recipe_connector";

type CapabilityActivationAccess = Pick<
  CapabilityDiscoverySources,
  "activatableToolIds" | "enabledToolIds"
>;

/**
 * A ready recipe or connector is useless unless the tool that runs it is switched on, so discovery
 * activates it for the rest of the response the same way it does a directly discovered tool.
 */
function resolveAutoActivation(
  toolName: string,
  access: CapabilityActivationAccess,
): { autoActivate: true } | Record<string, never> {
  return !access.enabledToolIds.has(toolName) && access.activatableToolIds.has(toolName)
    ? { autoActivate: true }
    : {};
}

export interface CapabilityDiscoveryFilters {
  configured?: boolean;
  kinds?: readonly CapabilityDiscoveryKind[];
  limit: number;
  query: string;
}

function createToolItem(
  tool: DiscoverableFunctionTool,
  access: Pick<CapabilityDiscoverySources, "enabledToolIds" | "isPro" | "isSignedIn">,
): CapabilityDiscoveryItem {
  const available =
    tool.type === "normal" ||
    (tool.type === "premium" && access.isPro) ||
    (tool.type === "byok" && access.isSignedIn);
  const enabled = access.enabledToolIds.has(tool.id);
  const autoActivate = available && !enabled && tool.activation.allowed;
  const ready = available && tool.activation.allowed && (enabled || autoActivate);
  const unavailableReason =
    available && !tool.activation.allowed
      ? tool.activation.reason || "This tool is blocked by the current tool policy."
      : tool.type === "premium"
        ? "This tool requires a Pro plan."
        : "This tool requires a signed-in account with provider credentials.";

  return {
    id: `tool:${tool.id}`,
    kind: "tool",
    name: tool.name,
    description: tool.description,
    configured: available,
    state: ready ? "ready" : "unavailable",
    reason: ready
      ? autoActivate
        ? "This tool will be enabled automatically for this response."
        : "This tool is enabled and ready to use."
      : unavailableReason,
    tags: ["tool", tool.type],
    invocation: {
      toolName: tool.id,
      availableNow: ready,
      ...(autoActivate ? { autoActivate: true } : {}),
      instruction: ready
        ? `Call ${tool.id} using its declared parameter schema.`
        : `Do not call ${tool.id}. ${unavailableReason}`,
    },
  };
}

function createConnectorItem(
  connector: RecipeConnectorManifest,
  isPro: boolean,
  access: CapabilityActivationAccess,
): CapabilityDiscoveryItem {
  const tags = [
    "connector",
    connector.authType,
    ...connector.categories.map((category) => category.name),
  ];

  if (!isPro) {
    return {
      id: `connector:${connector.id}`,
      kind: "connector",
      name: connector.name,
      description: connector.description,
      configured: false,
      state: "unavailable",
      reason: "Connectors require a Pro plan.",
      tags,
      invocation: {
        toolName: CONNECTOR_EXECUTION_TOOL_NAME,
        availableNow: false,
        instruction: `Do not call ${CONNECTOR_EXECUTION_TOOL_NAME}; connectors require a Pro plan.`,
      },
    };
  }

  if (connector.status === "connected") {
    return {
      id: `connector:${connector.id}`,
      kind: "connector",
      name: connector.name,
      description: connector.description,
      configured: true,
      state: "ready",
      reason: `${connector.name} is connected and ready to use.`,
      tags,
      invocation: {
        toolName: CONNECTOR_EXECUTION_TOOL_NAME,
        availableNow: true,
        ...resolveAutoActivation(CONNECTOR_EXECUTION_TOOL_NAME, access),
        instruction: `Call ${CONNECTOR_EXECUTION_TOOL_NAME} with provider "${connector.id}" and a useCase first, then call it again with the returned operation and sessionId.`,
      },
    };
  }

  if (connector.status === "unconfigured") {
    return {
      id: `connector:${connector.id}`,
      kind: "connector",
      name: connector.name,
      description: connector.description,
      configured: false,
      state: "unavailable",
      reason: `${connector.name} is not configured for this Polychat deployment.`,
      tags,
      invocation: {
        toolName: CONNECTOR_EXECUTION_TOOL_NAME,
        availableNow: false,
        instruction: `Do not call ${CONNECTOR_EXECUTION_TOOL_NAME}; ${connector.name} is unavailable in this deployment.`,
      },
    };
  }

  return {
    id: `connector:${connector.id}`,
    kind: "connector",
    name: connector.name,
    description: connector.description,
    configured: false,
    state: "setup_required",
    reason: `${connector.name} needs to be connected before it can be used.`,
    tags,
    invocation: {
      toolName: CONNECTOR_EXECUTION_TOOL_NAME,
      availableNow: false,
      instruction: `Wait for the user to connect ${connector.name}. Then call ${CONNECTOR_EXECUTION_TOOL_NAME} with provider "${connector.id}" and a useCase.`,
    },
    setup: { kind: "connector", provider: connector.id },
  };
}

function createRecipeItem(params: {
  access: CapabilityActivationAccess;
  recipe: AssistantRecipe;
  installation?: RecipeInstallation;
  isPro: boolean;
}): CapabilityDiscoveryItem {
  const { recipe, installation, isPro } = params;
  const configured = Boolean(installation);
  const blockingConnections = recipe.integrations.filter(
    (integration) => integration.requiresConnection && integration.connectionStatus !== "connected",
  );
  const unavailableConnections = blockingConnections.filter(
    (integration) => integration.connectionStatus === "unconfigured",
  );

  if (!isPro) {
    return {
      id: `recipe:${recipe.id}`,
      kind: "recipe",
      name: recipe.title,
      description: recipe.summary,
      configured,
      state: "unavailable",
      reason: "Recipes require a Pro plan.",
      tags: ["recipe", recipe.kind, recipe.category],
      invocation: {
        toolName: RECIPE_TRIGGER_TOOL_NAME,
        availableNow: false,
        instruction: `Do not call ${RECIPE_TRIGGER_TOOL_NAME}; recipes require a Pro plan.`,
      },
    };
  }

  if (unavailableConnections.length > 0) {
    return {
      id: `recipe:${recipe.id}`,
      kind: "recipe",
      name: recipe.title,
      description: recipe.summary,
      configured,
      state: "unavailable",
      reason: `Required connectors are not configured for this deployment: ${unavailableConnections
        .map((integration) => integration.name)
        .join(", ")}.`,
      tags: ["recipe", recipe.kind, recipe.category],
      invocation: {
        toolName: RECIPE_TRIGGER_TOOL_NAME,
        availableNow: false,
        instruction: `Do not call ${RECIPE_TRIGGER_TOOL_NAME}; this recipe has deployment-level connector requirements that cannot be configured by the user.`,
      },
    };
  }

  if (installation?.status === "active" && blockingConnections.length === 0) {
    return {
      id: `recipe:${recipe.id}`,
      kind: "recipe",
      name: recipe.title,
      description: recipe.summary,
      configured: true,
      state: "ready",
      reason: "This recipe is installed and its required connectors are ready.",
      tags: ["recipe", recipe.kind, recipe.category],
      invocation: {
        toolName: RECIPE_TRIGGER_TOOL_NAME,
        availableNow: true,
        ...resolveAutoActivation(RECIPE_TRIGGER_TOOL_NAME, params.access),
        instruction: `Call ${RECIPE_TRIGGER_TOOL_NAME} with recipeId "${recipe.id}" and pass the user's request as input.`,
      },
    };
  }

  return {
    id: `recipe:${recipe.id}`,
    kind: "recipe",
    name: recipe.title,
    description: recipe.summary,
    configured,
    state: "setup_required",
    reason:
      blockingConnections.length > 0
        ? `Connect ${blockingConnections.map((integration) => integration.name).join(", ")} to use this recipe.`
        : installation?.status === "paused"
          ? "This recipe is installed but paused."
          : "This recipe needs to be installed before it can be used.",
    tags: ["recipe", recipe.kind, recipe.category],
    invocation: {
      toolName: RECIPE_TRIGGER_TOOL_NAME,
      availableNow: false,
      instruction: `Wait for the user to finish recipe setup. Then call ${RECIPE_TRIGGER_TOOL_NAME} with recipeId "${recipe.id}" and pass the user's request as input.`,
    },
    setup: { kind: "recipe", recipeId: recipe.id },
  };
}

function scoreItem(item: CapabilityDiscoveryItem, query: string): number {
  const normalisedQuery = query.trim().toLowerCase();
  const terms = normalisedQuery.split(/\s+/).filter(Boolean);
  const name = item.name.toLowerCase();
  const id = item.id.toLowerCase();
  const description = item.description?.toLowerCase() ?? "";
  const tags = item.tags.join(" ").toLowerCase();
  let score = 0;

  if (name === normalisedQuery || id === normalisedQuery) {
    score += 100;
  }

  if (name.includes(normalisedQuery) || id.includes(normalisedQuery)) {
    score += 30;
  }

  if (description.includes(normalisedQuery)) {
    score += 15;
  }

  for (const term of terms) {
    if (name.includes(term) || id.includes(term)) {
      score += 10;
    }

    if (description.includes(term)) {
      score += 5;
    }

    if (tags.includes(term)) {
      score += 3;
    }
  }

  return score;
}

export function discoverAssistantCapabilities(
  sources: CapabilityDiscoverySources,
  filters: CapabilityDiscoveryFilters,
): CapabilityDiscoveryResult {
  const ownInstallations = new Map(
    sources.installations.map((installation) => [installation.recipeId, installation]),
  );
  const items = [
    ...sources.tools.map((tool) => createToolItem(tool, sources)),
    ...sources.recipes.map((recipe) =>
      createRecipeItem({
        access: sources,
        recipe,
        installation: ownInstallations.get(recipe.id),
        isPro: sources.isPro,
      }),
    ),
    ...sources.connectors.map((connector) =>
      createConnectorItem(connector, sources.isPro, sources),
    ),
  ];
  const allowedKinds = filters.kinds?.length ? new Set(filters.kinds) : null;
  const matches = items
    .filter((item) => !allowedKinds || allowedKinds.has(item.kind))
    .filter((item) =>
      filters.configured === undefined ? true : item.configured === filters.configured,
    )
    .map((item) => ({ item, score: scoreItem(item, filters.query) }))
    .filter(({ score }) => score > 0)
    .sort(
      (left, right) => right.score - left.score || left.item.name.localeCompare(right.item.name),
    );

  return {
    query: filters.query,
    items: matches.slice(0, filters.limit).map(({ item }) => item),
    total: matches.length,
    ...(sources.projectId ? { projectId: sources.projectId } : {}),
  };
}
