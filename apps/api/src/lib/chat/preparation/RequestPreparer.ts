import type {
  ChatHostedToolSettings,
  Goal,
  ModelConfigInfo,
  ModelConfigItem,
  RecipeConnectorProvider,
  SkillAvailability,
} from "@ngriffin_uk/polychat-schemas";

import { mergeEnabledGoalToolNames } from "~/lib/chat/policy/goal-tools";
import { mergeEnabledMemoryToolNames, resolveMemoryPolicy } from "~/lib/chat/policy/memory";
import { ConversationManager } from "~/lib/conversationManager";
import { Database } from "~/lib/database";
import { RepositoryManager } from "~/repositories";
import {
  getConnectedRecipeConnectorProviders,
  listRecipeConnectors,
} from "~/services/apps/connectors";
import { resolveEnabledFunctionToolNames } from "~/services/functions/availability";
import {
  buildSkillAvailabilityInput,
  listSkillAvailability,
  mergeSkillSuggestedToolNames,
} from "~/services/skills";
import {
  getModelToolDefinition,
  mergePersonalModelToolOptions,
  resolveModelToolConfigurations,
  type StoredModelToolConfiguration,
} from "~/services/tools/modelToolConfiguration";
import {
  applyProjectCodingEnvironment,
  resolveProjectChatContext,
  type ProjectChatContext,
} from "~/services/workspaces/chatContext";
import type { ChatMode, CoreChatOptions, MemoryScope, Message, Platform } from "~/types";
import { intersectEnabledTools } from "~/utils/enabledTools";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";
import { memoizeRequest } from "~/utils/requestCache";
import { sanitiseInput } from "~/utils/sanitise";

import type { ValidationContext } from "../validation/ValidationPipeline";
import { loadActiveGoal } from "./goal";
import { storeUserTurn } from "./message-store";
import { buildModelConfigs, clearModelConfigCache } from "./model-configs";
import { buildProviderContext } from "./provider-context";
import { resolveScopedSkillCatalog, resolveSkillScope } from "./skills";
import { buildSystemPrompt } from "./system-prompt";

const logger = getLogger({ prefix: "lib/chat/preparation/RequestPreparer" });

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
  messageWithContext: string;
  userSettings: any;
  currentMode: ChatMode;
  isProUser: boolean;
  enabledTools: string[];
  activeGoal: Goal | null;
  toolOptions?: ChatHostedToolSettings;
  requestOptions: CoreChatOptions["options"];
  memoryScope: MemoryScope;
  connectedConnectorProviders?: RecipeConnectorProvider[];
}

interface SavedToolConfiguration {
  capabilityId: string;
  configuration: StoredModelToolConfiguration["configuration"];
}

interface RequestScope {
  options: CoreChatOptions;
  user: CoreChatOptions["context"] extends { user: infer U } ? U : any;
  database: Database;
  repositories: RepositoryManager;
  projectContext: ProjectChatContext | null;
  memoryScope: MemoryScope;
  isProUser: boolean;
  platform: Platform;
  mode: ChatMode;
}

export class RequestPreparer {
  private repositories: RepositoryManager;

  constructor(private env: any) {
    this.repositories = new RepositoryManager(env);
  }

  public static clearModelConfigCache() {
    clearModelConfigCache();
  }

  private async resolveScope(options: CoreChatOptions): Promise<RequestScope> {
    const { platform = "api", mode = "normal" } = options;
    const user = options.context?.user;
    const database = options.context?.database ?? new Database(this.env);
    const repositories = options.context?.repositories ?? database.repositories;
    const projectContext = options.context
      ? await resolveProjectChatContext(options.context, options)
      : null;

    return {
      options: { ...options, ...applyProjectCodingEnvironment(options, projectContext) },
      user,
      database,
      repositories,
      projectContext,
      memoryScope: projectContext
        ? { type: "project", projectId: projectContext.projectId }
        : { type: "personal" },
      isProUser: user?.plan_id === "pro",
      platform,
      mode,
    };
  }

  private resolveUserSettings(scope: RequestScope) {
    const { options, user, repositories } = scope;

    if (options.context?.getUserSettings) {
      return options.context.getUserSettings();
    }

    if (!user?.id) {
      return Promise.resolve(null);
    }

    return memoizeRequest(options.context?.requestCache, `user-settings:${user.id}`, () =>
      repositories.userSettings.getUserSettings(user.id),
    );
  }

  private resolveConnectedConnectorProviders(scope: RequestScope) {
    const { options, user, projectContext } = scope;
    const requestedTools = projectContext
      ? intersectEnabledTools(projectContext.enabledTools, options.enabled_tools)
      : options.enabled_tools;
    const enabledFunctionTools = resolveEnabledFunctionToolNames(requestedTools, user);

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
        logger.warn("Failed to resolve connected recipe providers", { error, userId: user.id });

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

    return repositories.capabilityConfigurations.list({ type: "user", id: user.id }, "tool");
  }

  private resolveMessageText(validationContext: ValidationContext): string {
    const { lastMessage } = validationContext;
    const lastMessageContent = Array.isArray(lastMessage!.content)
      ? lastMessage!.content
      : [{ type: "text" as const, text: lastMessage!.content as string }];

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
    const { user, database, repositories, projectContext, memoryScope, platform, mode } = scope;

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

    const finalMessage = this.resolveMessageText(validationContext);

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

    assertBackgroundRequestIsSupported(scope.options, primaryProvider);

    const conversationManager = ConversationManager.getInstance({
      database,
      repositories,
      user: user || undefined,
      anonymousUser: scope.options.anonymousUser,
      model: primaryModel,
      platform,
      store: scope.options.store,
      env: this.env,
      requestCache: scope.options.context?.requestCache,
    });

    const shouldStoreMessages =
      Boolean(scope.options.store) && scope.options.conversation_history_write_mode !== "append";

    const storeMessagesTask = shouldStoreMessages
      ? storeUserTurn({
          options: scope.options,
          conversationManager,
          lastMessage,
          finalMessage,
          primaryModel,
          platform,
          mode,
        })
      : null;

    const [skillScope, scopedSkillCatalog] = await Promise.all([
      skillScopePromise,
      scopedSkillCatalogPromise,
    ]);
    const enabledTools = projectContext
      ? intersectEnabledTools(projectContext.enabledTools, scope.options.enabled_tools)
      : scope.options.enabled_tools;
    const skills: readonly SkillAvailability[] = await listSkillAvailability(
      buildSkillAvailabilityInput({
        skillScope,
        supportsToolCalls: Boolean(primaryModelConfig.supportsToolCalls),
        enabledToolIds: new Set(enabledTools ?? []),
      }),
      scopedSkillCatalog?.listDefinitions(),
    );

    const activeGoal = await loadActiveGoal(scope.options);

    const systemPromptTask = buildSystemPrompt({
      options: scope.options,
      repositories: this.repositories,
      sanitisedMessages,
      finalMessage,
      primaryModel,
      userSettings,
      memoryPolicy,
      projectContext,
      memoryScope,
      skills,
      activeGoal,
    });

    if (storeMessagesTask) {
      await storeMessagesTask;
    }

    const systemPrompt = await systemPromptTask;

    const messages = await buildProviderContext({
      conversationManager,
      completionId: scope.options.completion_id,
      shouldStoreMessages,
      fallbackMessages: sanitisedMessages,
      messageWithContext,
      primaryModelConfig,
    });

    return {
      modelConfigs,
      primaryModel,
      primaryModelConfig,
      primaryProvider,
      conversationManager,
      messages,
      systemPrompt,
      messageWithContext,
      userSettings,
      currentMode: mode,
      isProUser: scope.isProUser,
      enabledTools: mergeSkillSuggestedToolNames({
        enabledTools: mergeEnabledGoalToolNames({
          enabledTools: mergeEnabledMemoryToolNames({
            enabledTools,
            user,
            userSettings,
            store: scope.options.store,
          }),
          isProUser: scope.isProUser,
        }),
        skills,
      }),
      activeGoal,
      toolOptions: this.resolveToolOptions(scope, savedToolConfigurations, enabledTools),
      requestOptions: scope.options.options,
      memoryScope,
      connectedConnectorProviders,
    };
  }
}
