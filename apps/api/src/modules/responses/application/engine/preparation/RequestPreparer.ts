import type { ContextBudgetSystemSection } from "@ngriffin_uk/polychat-ai-agents";
import { chatRunReservationExpiresAt } from "@ngriffin_uk/polychat-ai-billing";
import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { hasProEntitlement } from "@ngriffin_uk/polychat-library-policy";
import {
  getPermissionModeUnavailableReason,
  resolveEffectivePermissionMode,
  type ChatHostedToolSettings,
  type ConversationType,
  type Goal,
  type ChatContextDocument,
  type ModelConfigInfo,
  type ModelConfigItem,
  type PermissionMode,
  type RecipeConnectorProvider,
  type SkillAvailability,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { sanitiseInput } from "@ngriffin_uk/polychat-utility-server/sanitise";

import { createRepositories, type Repositories } from "~/infrastructure/database/repositories";
import { CapabilityConfigurationRepository } from "~/modules/capabilities/infrastructure/CapabilityConfigurationRepository";
import {
  getConnectedRecipeConnectorProviders,
  listRecipeConnectors,
} from "~/modules/connectors/application";
import { ConversationManager } from "~/modules/conversations/application/manager";
import type { ConversationWriteFence } from "~/modules/conversations/domain/write-fence";
import { ConversationRepository } from "~/modules/conversations/infrastructure/ConversationRepository";
import { isRecipeExecutionRequest } from "~/modules/recipes/application/toolContext";
import { loadActiveGoal } from "~/modules/responses/application/engine/preparation/goal";
import {
  loadRunMemoryDocuments,
  resolveRunMemoryScope,
} from "~/modules/responses/application/engine/preparation/memory-scope";
import { storeUserTurn } from "~/modules/responses/application/engine/preparation/message-store";
import { buildModelConfigs } from "~/modules/responses/application/engine/preparation/model-configs";
import { buildProviderContext } from "~/modules/responses/application/engine/preparation/provider-context";
import {
  resolveScopedSkillCatalog,
  resolveSkillScope,
} from "~/modules/responses/application/engine/preparation/skills";
import {
  buildSystemPrompt,
  projectRunMemory,
} from "~/modules/responses/application/engine/preparation/system-prompt";
import {
  buildLatestTurn,
  loadPolyAgendaPrompt,
} from "~/modules/responses/application/engine/preparation/turn-context";
import { resolveToolIntentRequest } from "~/modules/responses/application/engine/tools/tool-intent";
import type { ValidationContext } from "~/modules/responses/application/engine/validation/ValidationPipeline";
import { isBuiltInToolApprovalResolution } from "~/modules/responses/application/runs/interactions";
import {
  GOAL_COMPLETE_TOOL_NAME,
  mergeEnabledGoalToolNames,
} from "~/modules/responses/domain/goal-tools";
import {
  mergeEnabledMemoryToolNames,
  resolveMemoryPolicy,
} from "~/modules/responses/domain/memory";
import {
  buildSkillAvailabilityInput,
  listSkillAvailability,
  mergeSkillLoadToolName,
  mergeSkillSuggestedToolNames,
} from "~/modules/skills/application";
import {
  listPerMessageSkillCandidates,
  selectPerMessageSkills,
} from "~/modules/skills/application/per-message";
import { recordSkillUses } from "~/modules/skills/application/use-ledger";
import { resolvePlatformTeammateGrants } from "~/modules/teammates/application/platform-teammates";
import {
  resolveEnabledFunctionToolNames,
  resolveRequestFunctionToolNames,
} from "~/modules/tools/application/availability";
import {
  mergeNativeMcpToolNames,
  readMcpGatewayServers,
  shouldUseNativeMcpGateway,
} from "~/modules/tools/application/mcp-gateway-servers";
import {
  getModelToolDefinition,
  mergePersonalModelToolOptions,
  resolveModelToolConfigurations,
  type StoredModelToolConfiguration,
} from "~/modules/tools/application/modelToolConfiguration";
import { isAdmittedPolyRun } from "~/modules/tools/application/poly-turn-policy";
import { getRequestUserSettings } from "~/modules/user/application/request-settings";
import {
  applyProjectCodingEnvironment,
  resolveProjectChatContext,
  type ProjectChatContext,
} from "~/modules/workspaces/application/chatContext";
import type {
  ChatMode,
  CoreChatOptions,
  IUser,
  IUserSettings,
  MemoryScope,
  Message,
  Platform,
} from "~/types";

const logger = getLogger({ prefix: "services/chat/preparation/RequestPreparer" });

function assertBackgroundRequestIsSupported(options: CoreChatOptions, primaryProvider: string) {
  if (!options.background) {
    return;
  }

  if (primaryProvider !== "openai") {
    throw new AssistantError(
      "Background responses are only supported by OpenAI Responses models.",
      ErrorType.PARAMS_ERROR,
    );
  }
}

export interface PreparedRequest {
  modelConfigs: ModelConfigInfo[];
  primaryModel: string;
  primaryModelConfig: ModelConfigItem;
  primaryProvider: string;
  conversationManager: ConversationManager;
  messages: Message[];
  systemPrompt: string;
  systemPromptSections: ContextBudgetSystemSection[];
  messageWithContext: string;
  toolIntentRequest: string;
  userSettings: IUserSettings | null;
  currentMode: ChatMode;
  conversationType?: ConversationType;
  permissionMode?: PermissionMode;
  isProUser: boolean;
  enabledTools: string[];
  activeGoal: Goal | null;
  toolOptions?: ChatHostedToolSettings;
  requestOptions: CoreChatOptions["options"];
  memoryScope: MemoryScope;
  connectedConnectorProviders?: RecipeConnectorProvider[];
  contextSkills: Array<{ id: string; name: string }>;
  contextDocuments: ChatContextDocument[];
  analyticsProperties?: Record<string, string>;
}

interface SavedToolConfiguration {
  capabilityId: string;
  configuration: StoredModelToolConfiguration["configuration"];
}

interface RequestScope {
  options: CoreChatOptions;
  user: IUser | null | undefined;
  repositories: Repositories;
  projectContext: ProjectChatContext | null;
  hasFixedProjectTaskTools: boolean;
  memoryScope: MemoryScope;
  isProUser: boolean;
  platform: Platform;
  mode: ChatMode;
}

export class RequestPreparer {
  constructor(private env: CoreChatOptions["env"]) {}

  private async resolveScope(options: CoreChatOptions): Promise<RequestScope> {
    const { platform = "api", mode = "normal" } = options;
    const user = options.context?.user;
    const repositories = options.context?.repositories ?? createRepositories(this.env);
    const poly = options.context ? await isAdmittedPolyRun(options, repositories) : false;
    const projectContext =
      options.context && !poly ? await resolveProjectChatContext(options.context, options) : null;
    const scopedOptions: CoreChatOptions = poly
      ? {
          ...options,
          conversation_type: "poly",
          poly: options.poly ?? {},
          store: true,
          system_prompt: undefined,
          metadata: undefined,
        }
      : {
          ...options,
          ...applyProjectCodingEnvironment(options, projectContext),
        };

    return {
      options: scopedOptions,
      user,
      repositories,
      projectContext,
      hasFixedProjectTaskTools:
        scopedOptions.durable_execution?.kind === "project_task" &&
        scopedOptions.tool_selection_mode === "explicit",
      memoryScope: await resolveRunMemoryScope({
        options: scopedOptions,
        repositories,
        projectContext,
      }),
      isProUser: hasProEntitlement(user),
      platform,
      mode,
    };
  }

  private resolveUserSettings(scope: RequestScope) {
    return scope.options.context
      ? getRequestUserSettings(scope.options.context)
      : Promise.resolve(null);
  }

  private async resolveStoredPermissionMode(scope: RequestScope): Promise<unknown> {
    if (!scope.options.completion_id) {
      return undefined;
    }

    const conversation = await scope.repositories
      .get(ConversationRepository)
      .getConversation(scope.options.completion_id);

    return conversation?.permission_mode;
  }

  private resolveRequestTools(scope: RequestScope) {
    return resolveRequestFunctionToolNames({
      projectTools:
        scope.projectContext && scope.hasFixedProjectTaskTools
          ? [...scope.projectContext.enabledTools, GOAL_COMPLETE_TOOL_NAME]
          : scope.projectContext?.enabledTools,
      requestedToolNames: scope.options.enabled_tools,
      grantedToolNames: resolvePlatformTeammateGrants(scope.options.resolved_configuration)?.tools,
      toolSelectionMode: scope.options.tool_selection_mode,
      user: scope.user,
    });
  }

  private resolveConnectedConnectorProviders(scope: RequestScope) {
    const { options, user, projectContext } = scope;
    const enabledFunctionTools = resolveEnabledFunctionToolNames(
      this.resolveRequestTools(scope),
      user,
    );

    if (!user?.id || !options.context || !enabledFunctionTools.has("use_recipe_connector")) {
      return Promise.resolve(undefined);
    }

    return listRecipeConnectors({
      context: options.context,
      userId: user.id,
      requestUrl: options.app_url,
    })
      .then(({ connectors }) => {
        const connected = getConnectedRecipeConnectorProviders(connectors);

        return projectContext
          ? connected.filter((provider) => projectContext.connectorProviders.includes(provider))
          : connected;
      })
      .catch((error) => {
        logger.warn("Failed to resolve connected recipe providers", {
          error,
          userId: user.id,
        });

        return [];
      });
  }

  private resolveSavedToolConfigurations(scope: RequestScope) {
    const { options, user, projectContext, repositories } = scope;
    const needsSavedToolConfiguration = options.enabled_tools?.some(
      (toolId) => getModelToolDefinition(toolId)?.requiresConfiguration,
    );

    if (!user?.id || projectContext || !needsSavedToolConfiguration) {
      return Promise.resolve([]);
    }

    return repositories
      .get(CapabilityConfigurationRepository)
      .list({ type: "user", id: user.id }, "tool");
  }

  private resolveMessageText(validationContext: ValidationContext): string {
    const { lastMessage } = validationContext;
    const lastMessageContent = Array.isArray(lastMessage.content)
      ? lastMessage.content
      : [{ type: "text" as const, text: lastMessage.content as string }];

    return sanitiseInput(lastMessageContent.find((c) => c.type === "text")?.text || "");
  }

  private resolveToolOptions(
    scope: RequestScope,
    savedToolConfigurations: SavedToolConfiguration[],
    enabledTools?: string[],
  ): ChatHostedToolSettings | undefined {
    const { options, projectContext } = scope;

    if (projectContext) {
      return projectContext.toolOptions;
    }

    return mergePersonalModelToolOptions({
      configured: resolveModelToolConfigurations(
        savedToolConfigurations.map((configuration) => ({
          toolId: configuration.capabilityId,
          configuration: configuration.configuration,
        })),
      ),
      requestedEnabledTools: enabledTools,
      requestedToolOptions: options.tool_options,
    });
  }

  async prepare(
    options: CoreChatOptions,
    validationContext: ValidationContext,
    writeFence?: ConversationWriteFence,
    runId?: string,
  ): Promise<PreparedRequest> {
    const {
      sanitisedMessages,
      lastMessage,
      modelConfig: primaryModelConfig,
      messageWithContext,
    } = validationContext;

    if (!sanitisedMessages || !primaryModelConfig || !messageWithContext) {
      throw new AssistantError("Missing required validation context", ErrorType.PARAMS_ERROR);
    }

    const scope = await this.resolveScope(options);
    const { user, repositories, projectContext, platform, mode } = scope;

    const modelConfigsPromise = buildModelConfigs(scope.options, validationContext);
    const userSettingsPromise = this.resolveUserSettings(scope);
    const connectedConnectorProvidersPromise = this.resolveConnectedConnectorProviders(scope);
    const savedToolConfigurationsPromise = this.resolveSavedToolConfigurations(scope);
    const skillScopePromise = resolveSkillScope(
      projectContext,
      user?.id ? repositories : null,
      user?.id,
    );
    const scopedSkillCatalogPromise = resolveScopedSkillCatalog(scope.options, projectContext);
    const activeGoalPromise = loadActiveGoal(scope.options);

    const [modelConfigs, userSettings, savedToolConfigurations, connectedConnectorProviders] =
      await Promise.all([
        modelConfigsPromise,
        userSettingsPromise,
        savedToolConfigurationsPromise,
        connectedConnectorProvidersPromise,
      ]);

    const memoryPolicy = resolveMemoryPolicy({ user, userSettings, store: scope.options.store });
    const primaryModel = primaryModelConfig.matchingModel;
    const primaryProvider = primaryModelConfig.provider;

    let permissionMode: PermissionMode | undefined;

    if (primaryModelConfig.kind === "agent" && primaryModelConfig.agent) {
      permissionMode = resolveEffectivePermissionMode(
        scope.options.permission_mode,
        await this.resolveStoredPermissionMode(scope),
        primaryModelConfig.agent.permissionModes,
      );

      const unavailableReason = getPermissionModeUnavailableReason(
        primaryModelConfig.agent.capabilities,
        permissionMode,
        primaryModelConfig.agent.permissionModes,
      );

      if (unavailableReason) {
        throw new AssistantError(unavailableReason, ErrorType.PARAMS_ERROR);
      }
    }

    assertBackgroundRequestIsSupported(scope.options, primaryProvider);

    const conversationManager = ConversationManager.getInstance({
      repositories,
      user: user || undefined,
      anonymousUser: scope.options.anonymousUser,
      model: primaryModel,
      provider: primaryProvider,
      platform,
      store: scope.options.store,
      env: this.env,
      requestCache: scope.options.context?.requestCache,
      writeFence,
      runId,
      ...(runId && scope.options.durable_execution?.kind === "project_task"
        ? {
            durableTurnReservation: {
              kind: "chat_run" as const,
              refId: runId,
              expiresAt: chatRunReservationExpiresAt(),
            },
          }
        : runId && scope.options.durable_execution?.kind === "delegation"
          ? {
              durableTurnReservation: {
                kind: "chat_run" as const,
                refId: runId,
                creditMicros: scope.options.durable_execution.maxCreditMicros,
                expiresAt: chatRunReservationExpiresAt(),
              },
            }
          : {}),
    });

    const completionId = scope.options.completion_id;
    const isApprovalResolution = isBuiltInToolApprovalResolution(scope.options.options);
    const shouldStoreMessages =
      (scope.options.store ?? false) &&
      scope.options.conversation_history_write_mode !== "append" &&
      !isApprovalResolution;
    let toolIntentRequest = messageWithContext;

    if (completionId && isApprovalResolution) {
      toolIntentRequest = resolveToolIntentRequest(
        await conversationManager.get(completionId),
        messageWithContext,
      );
    }

    const finalMessage = isApprovalResolution
      ? toolIntentRequest
      : this.resolveMessageText(validationContext);

    const storeMessagesTask = shouldStoreMessages
      ? storeUserTurn({
          options: scope.options,
          conversationManager,
          lastMessage,
          finalMessage,
          primaryModel,
          modelId: validationContext.selectedModels?.[0] ?? primaryModel,
          modelTier: validationContext.modelTier ?? null,
          permissionMode: permissionMode ?? scope.options.permission_mode,
          platform,
          mode,
        })
      : null;

    const [skillScope, scopedSkillCatalog] = await Promise.all([
      skillScopePromise,
      scopedSkillCatalogPromise,
    ]);
    const enabledTools = this.resolveRequestTools(scope);
    const hasFixedToolScope =
      isRecipeExecutionRequest(scope.options) || scope.hasFixedProjectTaskTools;
    const skills: readonly SkillAvailability[] = hasFixedToolScope
      ? []
      : await listSkillAvailability(
          buildSkillAvailabilityInput({
            skillScope,
            supportsToolCalls: primaryModelConfig.supportsToolCalls ?? false,
            enabledToolIds: new Set(enabledTools ?? []),
          }),
          scopedSkillCatalog?.listDefinitions(),
        );

    const perMessageSkillsPromise = hasFixedToolScope
      ? Promise.resolve([])
      : selectPerMessageSkills({
          env: scope.options.env,
          user: user ?? undefined,
          conversationId: scope.options.completion_id,
          message: finalMessage,
          candidates: listPerMessageSkillCandidates(skills, scopedSkillCatalog),
        });
    const activeGoal = await activeGoalPromise;

    const systemPromptTask = buildSystemPrompt({
      options: scope.options,
      repositories,
      sanitisedMessages,
      finalMessage,
      primaryModel,
      userSettings,
      memoryPolicy,
      projectContext,
      memoryScope: scope.memoryScope,
      skills,
      activeGoal,
    });
    const polyAgendaPromise = loadPolyAgendaPrompt(scope.options, repositories);

    if (storeMessagesTask !== null) {
      await storeMessagesTask;
    }

    const baseSystemPrompt = await systemPromptTask;
    const runMemoryDocuments = await loadRunMemoryDocuments(
      scope.memoryScope,
      scope.options.context,
    );
    const memoryProjection = projectRunMemory(
      runMemoryDocuments,
      primaryModelConfig.contextWindow,
      baseSystemPrompt.prompt,
    );
    const contextDocuments = memoryProjection.documents;
    const systemPrompt = [baseSystemPrompt.prompt, memoryProjection.section]
      .filter(Boolean)
      .join("\n\n");
    const systemPromptSections: ContextBudgetSystemSection[] = memoryProjection.section
      ? [...baseSystemPrompt.sections, { kind: "memory", text: memoryProjection.section }]
      : baseSystemPrompt.sections;
    const skillTools = hasFixedToolScope
      ? enabledTools
      : mergeSkillLoadToolName({ enabledTools: enabledTools ?? [], skills });
    let preparedTools = mergeEnabledMemoryToolNames({
      enabledTools: skillTools,
      policy: memoryPolicy,
      hasBoundDocuments: runMemoryDocuments.length > 0,
      fixedToolScope: hasFixedToolScope,
    });

    if (!hasFixedToolScope) {
      const goalTools = mergeEnabledGoalToolNames({
        enabledTools: preparedTools,
        isProUser: scope.isProUser,
      });

      preparedTools = mergeSkillSuggestedToolNames({
        enabledTools: goalTools,
        skills,
        deferSuggestedTools: enabledTools !== undefined,
      });
    }

    const toolOptions = this.resolveToolOptions(scope, savedToolConfigurations, enabledTools);

    preparedTools = mergeNativeMcpToolNames({
      enabledTools: preparedTools,
      useNativeGateway: await shouldUseNativeMcpGateway({
        context: scope.options.context,
        enabledTools: preparedTools,
        servers: readMcpGatewayServers(toolOptions?.mcp_servers),
        supportsHostedMcp: primaryModelConfig.supportsMcp === true,
      }),
    });

    if (shouldStoreMessages && completionId && scope.options.options?.toolInteraction) {
      toolIntentRequest = resolveToolIntentRequest(
        await conversationManager.get(completionId),
        messageWithContext,
      );
    }

    const [perMessageSkills, polyAgenda] = await Promise.all([
      perMessageSkillsPromise,
      polyAgendaPromise,
    ]);

    if (perMessageSkills.length > 0 && user?.id && scopedSkillCatalog) {
      await recordSkillUses(
        repositories,
        perMessageSkills.flatMap((skill) => scopedSkillCatalog.loadRuntime(skill.id) ?? []),
        {
          userId: user.id,
          projectId: projectContext?.projectId ?? null,
          runId: runId ?? null,
          conversationId: scope.options.completion_id,
          activation: "per_message",
        },
      );
    }

    const latestTurn = buildLatestTurn({
      text: messageWithContext,
      poly: scope.options.poly,
      agenda: polyAgenda,
      activeGoal,
      skills: perMessageSkills,
    });
    const messages = await buildProviderContext({
      conversationManager,
      completionId: scope.options.completion_id,
      shouldStoreMessages,
      fallbackMessages: sanitisedMessages,
      latestTurn,
    });

    return {
      analyticsProperties: validationContext.analyticsProperties,
      modelConfigs,
      primaryModel,
      primaryModelConfig,
      primaryProvider,
      conversationManager,
      messages,
      systemPrompt,
      systemPromptSections,
      messageWithContext,
      toolIntentRequest,
      userSettings,
      currentMode: mode,
      conversationType: scope.options.conversation_type,
      permissionMode,
      isProUser: scope.isProUser,
      enabledTools: preparedTools,
      activeGoal,
      toolOptions,
      requestOptions: scope.options.options,
      memoryScope: scope.memoryScope,
      connectedConnectorProviders,
      contextSkills: skills
        .filter((skill) => skill.state === "ready")
        .map((skill) => ({ id: skill.id, name: skill.name })),
      contextDocuments,
    };
  }
}
