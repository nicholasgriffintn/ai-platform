import {
  recipeConnectorProviderSchema,
  type RecipeConnectorProvider,
} from "@ngriffin_uk/polychat-schemas";

import {
  getConnectorProviderConfig,
  connectorOperationRequiresApproval,
} from "~/lib/providers/capabilities/connectors";
import { COMPOSIO_CONNECTOR_SESSION_HANDLE_PATTERN } from "~/lib/providers/capabilities/connectors/composio/session-handle";
import {
  retainComposioConnectorSession,
  resolveComposioRunAccount,
} from "~/services/apps/connectors/composio-run";
import { authoriseConnectorOperation } from "~/services/apps/connectors/operation-approvals";
import {
  discoverRecipeConnectorTools,
  executeRecipeConnectorOperation,
} from "~/services/apps/connectors/operations";
import {
  getRecipeConfiguration,
  getActiveRecipeSetup,
  getRecipeAllowedConnectorOperations,
  getRecipeAllowedConnectorProviders,
  getRecipeExecutionChannel,
} from "~/services/apps/recipes/toolContext";
import { requireProjectAccess } from "~/services/workspaces/access";
import {
  resolveAllowedProjectConnectorOperations,
  resolveProjectRecipeConnectorScope,
  type ProjectRecipeConnectorScope,
} from "~/services/workspaces/projectRecipeConnectorScope";
import { AssistantError, ErrorType } from "~/utils/errors";
import { isRecord } from "~/utils/objects";
import { redactSensitiveTokens } from "~/utils/redaction";

import type { ApiToolDefinition } from "../../../types/functions";
import { jsonSchemaToZod } from "../../../utils/jsonSchema";

function buildConnectorToolError(params: {
  provider: string;
  operation: unknown;
  error: AssistantError;
  savedConfiguration?: Record<string, unknown>;
}) {
  const recoverable = params.error.type === ErrorType.PARAMS_ERROR;

  return {
    status: "error",
    name: "use_recipe_connector",
    content: recoverable
      ? `${params.error.message}. Retry use_recipe_connector with corrected params. If this is a recipe chat, use the savedConfiguration values from this tool result as defaults.`
      : params.error.message,
    data: {
      provider: params.provider,
      operation: params.operation,
      errorType: params.error.type,
      statusCode: params.error.statusCode,
      ...(recoverable
        ? {
            recoverable: true,
            ...(params.savedConfiguration ? { savedConfiguration: params.savedConfiguration } : {}),
          }
        : {}),
    },
  };
}

const PROMPT_ONLY_CONFIGURATION_KEYS = new Set(["preferredConnectors"]);

function mergeRecipeConfigurationIntoParams(
  params: unknown,
  configuration: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  const parameterConfiguration = configuration
    ? Object.fromEntries(
        Object.entries(configuration).filter(([key]) => !PROMPT_ONLY_CONFIGURATION_KEYS.has(key)),
      )
    : undefined;

  if (!parameterConfiguration) {
    return isRecord(params) ? params : undefined;
  }

  if (!isRecord(params)) {
    return { ...parameterConfiguration };
  }

  return {
    ...parameterConfiguration,
    ...params,
  };
}

export function createUseRecipeConnectorInputSchema(
  providers: readonly RecipeConnectorProvider[] = recipeConnectorProviderSchema.options,
) {
  return jsonSchemaToZod({
    type: "object",
    properties: {
      provider: {
        type: "string",
        enum: [...providers],
        description:
          providers.length === 1
            ? `Use the connected provider: ${providers[0]}.`
            : "The connected provider to use.",
      },
      operation: {
        type: "string",
        description: "The exact operation ID returned by connector discovery.",
      },
      useCase: {
        type: "string",
        minLength: 3,
        maxLength: 1000,
        description:
          "Describe the connector task to discover the best exact tools and their current schemas.",
      },
      sessionId: {
        type: "string",
        pattern: COMPOSIO_CONNECTOR_SESSION_HANDLE_PATTERN,
        description: "The opaque session handle returned by a preceding discovery call.",
      },
      params: {
        type: "object",
        description: "Parameters matching the exact schema returned by connector discovery.",
      },
    },
    required: ["provider"],
    additionalProperties: false,
  });
}

export const use_recipe_connector: ApiToolDefinition = {
  name: "use_recipe_connector",
  description:
    "Discover and use the exact tools available from a connector. Start with useCase to receive authoritative Composio schemas and a sessionId, then call again with an exact operation, its params, and that sessionId. Treat identifiers as operation-specific: never pass an ID returned by one operation to another unless their schemas explicitly describe the same identifier. Recipe configuration is merged into execution params as defaults.",
  type: "premium",
  costPerCall: 0,
  permissions: ["network", "read"],
  inputSchema: createUseRecipeConnectorInputSchema(),
  execute: async (args, context) => {
    const request = context.request;

    if (!request.context || !request.user?.id) {
      throw new Error("Signed-in user context is required for recipe connector tools");
    }

    const parsedProvider = recipeConnectorProviderSchema.safeParse(args.provider);

    if (!parsedProvider.success) {
      return {
        status: "error",
        name: "use_recipe_connector",
        content: "Choose a supported recipe connector provider.",
        data: { provider: args.provider },
      };
    }

    const provider = parsedProvider.data;
    const savedConfiguration = getRecipeConfiguration(request.request?.options);
    const activeRecipe = getActiveRecipeSetup(request.request?.options);
    const projectId =
      request.memoryScope?.type === "project"
        ? request.memoryScope.projectId
        : typeof request.request?.metadata?.project_id === "string"
          ? request.request.metadata.project_id
          : undefined;
    const recipeAllowedConnectorProviders = getRecipeAllowedConnectorProviders(
      request.request?.options,
    );
    let projectConnectorScope: ProjectRecipeConnectorScope | undefined;

    if (projectId) {
      await requireProjectAccess(request.context, projectId);
      const capabilities =
        await request.context.repositories.workspaces.listProjectCapabilities(projectId);

      projectConnectorScope = resolveProjectRecipeConnectorScope(capabilities);
    }

    const allowedConnectorProviders = projectConnectorScope
      ? projectConnectorScope.providers.filter(
          (candidate) =>
            !recipeAllowedConnectorProviders || recipeAllowedConnectorProviders.includes(candidate),
        )
      : recipeAllowedConnectorProviders;

    if (allowedConnectorProviders && !allowedConnectorProviders.includes(provider)) {
      return {
        status: "error",
        name: "use_recipe_connector",
        content: `The ${provider || "requested"} connector is not enabled for this recipe.`,
        data: {
          provider,
          allowedConnectorProviders,
        },
      };
    }

    const recipeAllowedConnectorOperations = getRecipeAllowedConnectorOperations(
      request.request?.options,
      provider,
    );
    const allowedConnectorOperations = resolveAllowedProjectConnectorOperations({
      projectScope: projectConnectorScope,
      provider,
      recipeOperations: recipeAllowedConnectorOperations,
    });
    const providerConfig = getConnectorProviderConfig(provider);
    const effectiveAllowedOperations =
      allowedConnectorOperations ??
      providerConfig?.operations.map((operation) => operation.id) ??
      [];
    const operation = typeof args.operation === "string" ? args.operation.trim() : "";
    const useCase = typeof args.useCase === "string" ? args.useCase.trim() : "";

    if (!operation && !useCase) {
      return {
        status: "error",
        name: "use_recipe_connector",
        content: "Provide useCase to discover tools, or operation to execute a discovered tool.",
        data: { provider },
      };
    }

    if (operation && !effectiveAllowedOperations.includes(operation)) {
      return {
        status: "error",
        name: "use_recipe_connector",
        content: `The ${provider || "requested"} connector operation is not enabled for this recipe.`,
        data: {
          provider,
          operation,
          allowedConnectorOperations: effectiveAllowedOperations,
        },
      };
    }

    if (!operation) {
      try {
        const discovery = await discoverRecipeConnectorTools({
          context: request.context,
          userId: request.user.id,
          provider,
          useCase,
          allowedOperations: effectiveAllowedOperations,
          completionId: request.request?.completion_id ?? context.completionId,
          recipeId: activeRecipe?.id,
          installationId: activeRecipe?.installationId,
          projectId,
        });

        return {
          status: "success",
          name: "use_recipe_connector",
          content:
            "Connector tools discovered. Choose the exact operation and pass its schema-valid params with this sessionId. Identifiers are operation-specific unless the schemas explicitly describe the same identifier.",
          data: discovery,
        };
      } catch (error) {
        if (error instanceof AssistantError) {
          return buildConnectorToolError({ provider, operation: "discover", error });
        }

        throw error;
      }
    }

    const channel = getRecipeExecutionChannel(request.request?.options) ?? "web";

    if (
      (channel === "scheduled" || channel === "event") &&
      connectorOperationRequiresApproval(provider, operation)
    ) {
      return {
        status: "error",
        name: "use_recipe_connector",
        content: `${channel === "event" ? "Event-triggered" : "Scheduled"} recipe runs cannot perform connector write operations. Ask the user to run this recipe in chat if an external change is required.`,
        data: {
          provider,
          operation,
          channel,
        },
      };
    }

    let data: unknown;

    try {
      const params = mergeRecipeConfigurationIntoParams(args.params, savedConfiguration);
      const scope = {
        completionId: request.request?.completion_id ?? context.completionId,
        recipeId: activeRecipe?.id,
        installationId: activeRecipe?.installationId,
        projectId,
      };
      const resolvedRunAccount =
        providerConfig?.auth.authType === "composio" && args.sessionId
          ? await resolveComposioRunAccount({
              context: request.context,
              userId: request.user.id,
              provider: providerConfig,
              operationId: operation,
              sessionId: args.sessionId,
              scope,
            })
          : undefined;
      const approval = await authoriseConnectorOperation({
        context: request.context,
        userId: request.user.id,
        provider,
        operation,
        arguments: params ?? {},
        connectedAccountId: resolvedRunAccount?.connectedAccount.id,
        channel,
        scope,
        approvalId: request.request?.connector_approval_id,
      });

      if (approval.required && !approval.approved) {
        if (typeof args.sessionId === "string") {
          retainComposioConnectorSession(request.context, args.sessionId);
        }

        return {
          status: "pending",
          name: "use_recipe_connector",
          content: `Approval is required before ${provider} can run ${operation}.`,
          data: {
            approvalRequired: true,
            approvalId: approval.approval?.id,
            provider,
            operation,
            argumentSummary: redactSensitiveTokens(params ?? {}),
            expiresAt: approval.approval?.expiresAt,
            humanInTheLoop: {
              type: "approval",
              status: "pending",
              requires_user_action: true,
            },
          },
        };
      }

      data = await executeRecipeConnectorOperation({
        context: request.context,
        userId: request.user.id,
        request: {
          provider,
          operation,
          params,
          sessionId: typeof args.sessionId === "string" ? args.sessionId : undefined,
        },
        scope,
      });
    } catch (error) {
      if (error instanceof AssistantError) {
        return buildConnectorToolError({
          provider,
          operation,
          error,
          savedConfiguration,
        });
      }

      throw error;
    }

    return {
      status: "success",
      name: "use_recipe_connector",
      content: "Connector operation completed",
      data: isRecord(data) && "data" in data ? data.data : data,
    };
  },
};
