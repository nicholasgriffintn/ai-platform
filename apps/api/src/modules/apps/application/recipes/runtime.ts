import { renderPrompt } from "@ngriffin_uk/polychat-ai-prompts";
import type {
  AssistantRecipe,
  AssistantRecipeConnection,
  RecipeConfiguration,
  RecipeConfigurationField,
  RecipeConnectorProvider,
  RecipeInstallation,
} from "@ngriffin_uk/polychat-schemas";
import { recipeConnectorProviderSchema } from "@ngriffin_uk/polychat-schemas";

import { isConnectorOperationSupported } from "~/infrastructure/providers/capabilities/connectors";

import { RECIPE_LOOKUP_TOOL, RECIPE_SETUP_TOOL } from "./catalog/shared";

export interface RecipeRuntimeContext {
  allowedConnectorOperations: Record<string, string[]>;
  allowedConnectorProviders: RecipeConnectorProvider[];
  checklist?: string[];
  conversationStarter: string;
  enabledTools: string[];
  messageUrl: string;
}

export function buildRecipeConnections(recipe: AssistantRecipe): AssistantRecipeConnection[] {
  return recipe.integrations.map((integration) => ({
    integrationId: integration.id,
    providerId: integration.providerId,
    name: integration.name,
    status: integration.connectionStatus ?? "unknown",
    requiresConnection: integration.requiresConnection,
    connectionGroup: integration.connectionGroup,
    setupUrl: integration.setupUrl,
  }));
}

function isUnavailableConnectionStatus(status: AssistantRecipeConnection["status"]) {
  return status === "missing" || status === "unknown" || status === "unconfigured";
}

export function getBlockingConnections(connections: AssistantRecipeConnection[]) {
  const connectedGroups = new Set(
    connections
      .filter((connection) => connection.connectionGroup && connection.status === "connected")
      .map((connection) => connection.connectionGroup),
  );

  return connections.filter(
    (connection) =>
      connection.requiresConnection &&
      isUnavailableConnectionStatus(connection.status) &&
      (!connection.connectionGroup || !connectedGroups.has(connection.connectionGroup)),
  );
}

export function isRequiredRecipeConfigurationValueMissing(
  field: RecipeConfigurationField,
  value: RecipeConfiguration[string] | undefined,
) {
  const resolvedValue = value ?? field.defaultValue;

  if (field.type === "boolean") {
    return resolvedValue !== true;
  }

  if (field.type === "number") {
    return typeof resolvedValue !== "number" || !Number.isFinite(resolvedValue);
  }

  if (field.type === "string_list") {
    return (
      !Array.isArray(resolvedValue) ||
      resolvedValue.map((item) => item.trim()).filter(Boolean).length === 0
    );
  }

  return typeof resolvedValue !== "string" || !resolvedValue.trim();
}

export function buildRecipeSetupRuntime(params: {
  recipe: AssistantRecipe;
  connections: AssistantRecipeConnection[];
  configuration?: RecipeConfiguration;
}): RecipeRuntimeContext {
  const enabledTools = Array.from(
    new Set([...params.recipe.enabledTools, RECIPE_LOOKUP_TOOL, RECIPE_SETUP_TOOL]),
  );
  const conversationStarter = createConversationStarter({
    recipe: params.recipe,
    connections: params.connections,
    enabledTools,
    configuration: params.configuration,
  });

  return {
    conversationStarter,
    messageUrl: createRecipeMessageUrl(params.recipe.id, "setup"),
    checklist: buildRecipeChecklist(params.recipe, params.connections, enabledTools),
    enabledTools,
    allowedConnectorProviders: buildAllowedConnectorProviders(params.recipe),
    allowedConnectorOperations: buildAllowedConnectorOperations(params.recipe),
  };
}

export function buildRecipeInvocationRuntime(params: {
  recipe: AssistantRecipe;
  connections: AssistantRecipeConnection[];
  installation: RecipeInstallation | null;
  input?: string;
  configuration?: RecipeConfiguration;
}): RecipeRuntimeContext {
  const enabledTools = Array.from(new Set(params.recipe.enabledTools));
  const prompt = params.installation
    ? buildRecipeInvocationPrompt({
        recipe: params.recipe,
        installation: params.installation,
        input: params.input,
      })
    : params.recipe.setupPrompt;
  const conversationStarter = createConversationStarter({
    recipe: params.recipe,
    connections: params.connections,
    enabledTools,
    configuration: params.configuration,
    input: params.input,
    prompt,
  });

  return {
    conversationStarter,
    messageUrl: createRecipeMessageUrl(params.recipe.id, params.installation ? "run" : "setup"),
    enabledTools,
    allowedConnectorProviders: buildAllowedConnectorProviders(params.recipe),
    allowedConnectorOperations: buildAllowedConnectorOperations(params.recipe),
  };
}

export function buildAllowedConnectorProviders(recipe: AssistantRecipe): RecipeConnectorProvider[] {
  const providers = new Set<RecipeConnectorProvider>();

  for (const integration of recipe.integrations) {
    const parsed = recipeConnectorProviderSchema.safeParse(integration.providerId);

    if (parsed.success) {
      providers.add(parsed.data);
    }
  }

  return Array.from(providers);
}

export function buildAllowedConnectorOperations(recipe: AssistantRecipe): Record<string, string[]> {
  const operationsByProvider = new Map<RecipeConnectorProvider, Set<string>>();

  for (const integration of recipe.integrations) {
    const parsed = recipeConnectorProviderSchema.safeParse(integration.providerId);

    if (!parsed.success) {
      continue;
    }

    for (const operationId of integration.operationIds ?? []) {
      if (!isConnectorOperationSupported(parsed.data, operationId)) {
        continue;
      }

      const operations = operationsByProvider.get(parsed.data) ?? new Set<string>();

      operations.add(operationId);
      operationsByProvider.set(parsed.data, operations);
    }
  }

  return Object.fromEntries(
    Array.from(operationsByProvider.entries()).map(([provider, operations]) => [
      provider,
      Array.from(operations),
    ]),
  );
}

function buildRecipeChecklist(
  recipe: AssistantRecipe,
  connections: AssistantRecipeConnection[],
  enabledTools = recipe.enabledTools,
) {
  const blockingConnections = getBlockingConnections(connections).map(
    (connection) => connection.name,
  );

  return [
    "Confirm the goal and target",
    blockingConnections.length > 0
      ? `Connect or verify ${blockingConnections.join(", ")}`
      : connections.length > 0
        ? "Review the connected integrations"
        : "Review the recipe setup",
    enabledTools.length > 0
      ? `Enable ${enabledTools.join(", ")} for this conversation`
      : "Use normal chat without extra tools",
    "Ask for confirmation before external writes",
  ];
}

function isRecipeConfigurationValuePresent(
  field: RecipeConfigurationField,
  value: RecipeConfiguration[string] | undefined,
): boolean {
  return !isRequiredRecipeConfigurationValueMissing(field, value);
}

function formatRecipeConfigurationValue(value: RecipeConfiguration[string]): string {
  if (Array.isArray(value)) {
    return value.join(", ");
  }

  return String(value);
}

function buildRecipeConfigurationContext(
  recipe: AssistantRecipe,
  configuration: RecipeConfiguration | undefined,
): string {
  if (!configuration) {
    return "";
  }

  const savedFields = recipe.configurationFields.filter((field) =>
    isRecipeConfigurationValuePresent(field, configuration[field.key]),
  );
  const missingRequiredFields = recipe.configurationFields.filter(
    (field) =>
      field.required && !isRecipeConfigurationValuePresent(field, configuration[field.key]),
  );
  const missingOptionalFields = recipe.configurationFields.filter(
    (field) =>
      !field.required && !isRecipeConfigurationValuePresent(field, configuration[field.key]),
  );
  const lines: string[] = [];

  if (savedFields.length > 0) {
    lines.push(
      "Saved recipe configuration:",
      ...savedFields.map(
        (field) =>
          `- ${field.label} (${field.key}): ${formatRecipeConfigurationValue(
            configuration[field.key],
          )}`,
      ),
      "Use saved recipe configuration as defaults. Do not ask me to reconfirm saved configuration values.",
    );
  }

  if (missingRequiredFields.length === 0 && savedFields.length > 0) {
    lines.push("This recipe is already configured.");
  } else if (missingRequiredFields.length > 0) {
    lines.push(
      `Missing required recipe configuration: ${missingRequiredFields
        .map((field) => field.label)
        .join(", ")}.`,
    );
  }

  if (missingOptionalFields.length > 0) {
    lines.push(
      `Missing optional recipe configuration: ${missingOptionalFields
        .map((field) => field.label)
        .join(", ")}. Ask for optional values only when the current request needs them.`,
    );
  }

  return lines.length > 0 ? `\n${lines.join("\n")}\n` : "";
}

const PREFERRED_CONNECTORS_CONFIGURATION_KEY = "preferredConnectors";

function getPreferredConnectorNames(configuration: RecipeConfiguration | undefined): string[] {
  const value = configuration?.[PREFERRED_CONNECTORS_CONFIGURATION_KEY];

  if (typeof value === "string") {
    return value.trim() ? [value.trim()] : [];
  }

  if (Array.isArray(value)) {
    return value.map((item) => item.trim()).filter(Boolean);
  }

  return [];
}

function buildConnectorSelectionGuidance(params: {
  recipe: AssistantRecipe;
  connections: AssistantRecipeConnection[];
  configuration?: RecipeConfiguration;
  enabledTools: string[];
}): string {
  const requiredConnections = params.connections.filter(
    (connection) => connection.requiresConnection,
  );
  const optionalConnections = params.connections.filter(
    (connection) => !connection.requiresConnection && connection.status === "connected",
  );

  if (requiredConnections.length === 0 && optionalConnections.length === 0) {
    return "";
  }

  const connected = requiredConnections.filter((connection) => connection.status === "connected");
  const preferredConnectors = getPreferredConnectorNames(params.configuration);
  const supportsPreferredConnectors = params.recipe.configurationFields.some(
    (field) => field.key === PREFERRED_CONNECTORS_CONFIGURATION_KEY,
  );
  const lines: string[] = [];

  if (preferredConnectors.length > 0) {
    lines.push(
      `Preferred services: ${preferredConnectors.join(", ")}. Use them without asking which service to use, and mention alternatives only if a preferred service is disconnected.`,
    );
  } else if (connected.length === 1) {
    lines.push(
      `${connected[0].name} is the only connected service for this recipe. Use it automatically and do not ask which service to use.`,
    );
  } else if (connected.length > 1) {
    const names = connected.map((connection) => connection.name).join(", ");

    lines.push(
      supportsPreferredConnectors && params.enabledTools.includes(RECIPE_SETUP_TOOL)
        ? `Multiple services are connected (${names}). Ask once which to use, then save the choice with ${RECIPE_SETUP_TOOL} as ${PREFERRED_CONNECTORS_CONFIGURATION_KEY} so future runs do not ask again. If I do not mind, choose sensibly and save that choice.`
        : `Multiple services are connected (${names}). Choose the service that best fits the request, state which one you used, and stay consistent within this conversation.`,
    );
  }

  const groups = new Map<string, AssistantRecipeConnection[]>();

  for (const connection of requiredConnections) {
    if (connection.connectionGroup) {
      const group = groups.get(connection.connectionGroup) ?? [];

      group.push(connection);
      groups.set(connection.connectionGroup, group);
    }
  }

  const unsatisfiedGroups = Array.from(groups.values()).filter(
    (group) => !group.some((connection) => connection.status === "connected"),
  );

  for (const group of unsatisfiedGroups) {
    lines.push(
      `Connect one of ${group.map((connection) => connection.name).join(" or ")} before running the parts of this recipe that need it; any one of them is enough.`,
    );
  }

  if (groups.size > 0 && unsatisfiedGroups.length < groups.size) {
    lines.push(
      "Alternative services in a satisfied connection group are optional. Never ask me to connect a service when an alternative for the same purpose is already connected.",
    );
  }

  if (optionalConnections.length > 0) {
    lines.push(
      `Optional connected context: ${optionalConnections
        .map((connection) => connection.name)
        .join(
          ", ",
        )}. Use them to enrich the result when relevant; never block on services that are not connected.`,
    );
  }

  return lines.length > 0 ? lines.map((line) => `- ${line}`).join("\n") : "";
}

function createConversationStarter(params: {
  recipe: AssistantRecipe;
  connections: AssistantRecipeConnection[];
  input?: string;
  enabledTools?: string[];
  configuration?: RecipeConfiguration;
  prompt?: string;
}) {
  const enabledTools = params.enabledTools ?? params.recipe.enabledTools;
  const prompt = params.prompt ?? params.recipe.setupPrompt;
  const connectorStatus =
    params.connections.length > 0
      ? params.connections
          .map(
            (connection) =>
              `- ${connection.name}${connection.connectionGroup ? ` (${connection.connectionGroup} option)` : ""}: ${connection.status.replace("_", " ")}`,
          )
          .join("\n")
      : undefined;
  const selectionGuidance = buildConnectorSelectionGuidance({
    recipe: params.recipe,
    connections: params.connections,
    configuration: params.configuration,
    enabledTools,
  });
  const toolLine = enabledTools.length > 0 ? enabledTools.join(", ") : "no extra tools";
  const configurationContext = buildRecipeConfigurationContext(params.recipe, params.configuration);

  return renderPrompt("apps/recipes/conversation-starter", {
    recipePrompt: prompt,
    triggerInput: params.input?.trim() || undefined,
    configurationContext: configurationContext || undefined,
    connectorStatus,
    connectorSelectionGuidance: selectionGuidance || undefined,
    enabledTools: toolLine,
    recipeLookupTool: enabledTools.includes(RECIPE_LOOKUP_TOOL) ? RECIPE_LOOKUP_TOOL : undefined,
    recipeSetupTool: enabledTools.includes(RECIPE_SETUP_TOOL) ? RECIPE_SETUP_TOOL : undefined,
  });
}

function getSavedSchedulePrompt(installation: RecipeInstallation | null): string | undefined {
  return installation?.triggers.find(
    (trigger) => trigger.type === "schedule" && trigger.enabled && trigger.prompt?.trim(),
  )?.prompt;
}

function buildRecipeInvocationPrompt(params: {
  recipe: AssistantRecipe;
  installation: RecipeInstallation | null;
  input?: string;
}): string {
  const scheduledPrompt = params.input?.trim()
    ? undefined
    : getSavedSchedulePrompt(params.installation)?.trim();
  const instruction =
    scheduledPrompt ??
    renderPrompt("apps/recipes/invocation-default", { recipeTitle: params.recipe.title });
  const recipeSteps =
    params.recipe.actions.length > 0
      ? params.recipe.actions.map((action) => `- ${action}`).join("\n")
      : undefined;

  return renderPrompt("apps/recipes/invocation", {
    instruction,
    recipeDescription: params.recipe.description || params.recipe.summary,
    recipeSteps,
  });
}

export function createRecipeMessageUrl(recipeId: string, action: "run" | "setup") {
  return `/?${new URLSearchParams({ action, recipe: recipeId }).toString()}`;
}
