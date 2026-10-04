import { getConnectorOperationConfig } from "@ngriffin_uk/polychat-ai-integrations";
import { operationIsGranted } from "@ngriffin_uk/polychat-library-policy";
import {
  recipeConfigurationSchema,
  type AssistantRecipe,
  type RecipeConfiguration,
  type RecipeConfigurationField,
  type RecipeConnectorProvider,
} from "@ngriffin_uk/polychat-schemas";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

export function isRequiredRecipeConfigurationValueMissing(
  field: RecipeConfigurationField,
  value: RecipeConfiguration[string] | undefined,
): boolean {
  const resolved = value ?? field.defaultValue;

  switch (field.type) {
    case "boolean":
      return resolved !== true;
    case "number":
      return typeof resolved !== "number" || !Number.isFinite(resolved);
    case "string_list":
      return !Array.isArray(resolved) || !resolved.some((item) => item.trim());
    default:
      return typeof resolved !== "string" || !resolved.trim();
  }
}

function normaliseConfigurationValue(
  field: RecipeConfigurationField,
  value: RecipeConfiguration[string] | undefined,
): RecipeConfiguration[string] | undefined {
  if (value === undefined || value === null || value === "") {
    return field.defaultValue;
  }

  if (field.type === "number") {
    return typeof value === "number" && Number.isFinite(value) ? value : field.defaultValue;
  }

  if (field.type === "boolean") {
    return typeof value === "boolean" ? value : field.defaultValue;
  }

  if (field.type === "string_list") {
    const items = Array.isArray(value)
      ? value
      : typeof value === "string"
        ? value.split(/[\n,;]+/)
        : [];

    return items.length
      ? items
          .map((item) => item.trim())
          .filter(Boolean)
          .slice(0, 50)
      : field.defaultValue;
  }

  return typeof value === "string" ? value.trim() || field.defaultValue : field.defaultValue;
}

export function normaliseRecipeConfigurationForRecipe(
  recipe: AssistantRecipe | undefined,
  value: unknown,
): RecipeConfiguration {
  const parsed = recipeConfigurationSchema.safeParse(value);
  const configuration = parsed.success ? parsed.data : {};

  if (!recipe?.configurationFields.length) {
    return configuration;
  }

  const result: RecipeConfiguration = {};

  for (const field of recipe.configurationFields) {
    const normalised = normaliseConfigurationValue(field, configuration[field.key]);

    if (normalised !== undefined && normalised !== null && normalised !== "") {
      result[field.key] = normalised;
    }
  }

  return result;
}

function configuredKeys(
  recipe: AssistantRecipe,
  keys: string[],
  configuration: RecipeConfiguration,
): string[] {
  return keys.filter((key) => {
    const field = recipe.configurationFields.find((candidate) => candidate.key === key);

    return field && !isRequiredRecipeConfigurationValueMissing(field, configuration[key]);
  });
}

export function validateRecipeConfiguration(
  recipe: AssistantRecipe,
  configuration: RecipeConfiguration,
  requireComplete = false,
): void {
  const issues: string[] = [];

  for (const field of recipe.configurationFields) {
    const value = configuration[field.key] ?? field.defaultValue;

    if (isRequiredRecipeConfigurationValueMissing(field, value)) {
      if (requireComplete && field.required) {
        issues.push(`Provide ${field.label}`);
      }

      continue;
    }

    const size =
      typeof value === "number"
        ? value
        : typeof value === "string" || Array.isArray(value)
          ? value.length
          : undefined;

    if (
      size !== undefined &&
      ((field.minimum !== undefined && size < field.minimum) ||
        (field.maximum !== undefined && size > field.maximum))
    ) {
      issues.push(`${field.label} is outside its allowed range`);
    }

    if (field.integer && !Number.isInteger(value)) {
      issues.push(`${field.label} must be a whole number`);
    }

    if (field.pattern && (typeof value !== "string" || !new RegExp(field.pattern).test(value))) {
      issues.push(`${field.label} has an invalid format`);
    }
  }

  let configured = 0;

  for (const integration of recipe.integrations) {
    const keys = integration.configurationKeys;

    if (!keys?.length) {
      continue;
    }

    const present = configuredKeys(recipe, keys, configuration).length;

    if (present === keys.length) {
      configured += 1;
    } else if (present > 0) {
      issues.push(`Provide all resource fields for ${integration.name}`);
    }
  }

  if (requireComplete && recipe.connectorPolicy?.requireConfiguredIntegration && configured === 0) {
    issues.push("Map at least one connected service");
  }

  if (issues.length) {
    throw new AssistantError(issues.join("; "), ErrorType.PARAMS_ERROR, 400);
  }
}

export function requireRecipeConnectorAccess(
  recipe: AssistantRecipe | undefined,
  configuration: unknown,
  provider: RecipeConnectorProvider,
  operation?: string,
): void {
  if (!recipe) {
    return;
  }

  const values = recipeConfigurationSchema.parse(configuration);

  validateRecipeConfiguration(recipe, values, recipe.connectorPolicy?.requireConfiguredIntegration);
  const integration = recipe.integrations.find((entry) => entry.providerId === provider);
  const keys = integration?.configurationKeys;
  const mappingMissing =
    (recipe.connectorPolicy?.requireConfiguredIntegration && !integration) ||
    (keys?.length && configuredKeys(recipe, keys, values).length !== keys.length);
  const operationDenied =
    operation &&
    integration?.operationIds &&
    !operationIsGranted(integration.operationIds, operation);
  const accessDenied =
    operation &&
    recipe.connectorPolicy?.access &&
    getConnectorOperationConfig(provider, operation)?.access !== recipe.connectorPolicy.access;

  if (mappingMissing || operationDenied || accessDenied) {
    throw new AssistantError(
      "This recipe has no resource mapping or permission for that operation",
      ErrorType.AUTHORISATION_ERROR,
      403,
    );
  }
}

export function getRecipeConnectorParameters(
  recipe: AssistantRecipe | undefined,
  params: unknown,
  configuration?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (recipe?.connectorPolicy?.parameters === "explicit" || !configuration) {
    return isRecord(params) ? params : undefined;
  }

  const defaults = Object.fromEntries(
    Object.entries(configuration).filter(([key]) => key !== "preferredConnectors"),
  );

  return { ...defaults, ...(isRecord(params) ? params : {}) };
}

export function buildRecipeInvocationContext(
  recipe: AssistantRecipe,
  configuration?: RecipeConfiguration,
  now = new Date(),
): string {
  const context = recipe.invocationContext;

  if (!context) {
    return "";
  }

  validateRecipeConfiguration(recipe, configuration ?? {});
  const hours = context.windowHoursKey ? configuration?.[context.windowHoursKey] : undefined;
  const window =
    typeof hours === "number" && Number.isFinite(hours) && hours > 0
      ? `Evidence window (UTC): ${new Date(now.getTime() - hours * 3_600_000).toISOString()} to ${now.toISOString()}.`
      : "";

  return [context.instructions, window].filter(Boolean).join("\n");
}
