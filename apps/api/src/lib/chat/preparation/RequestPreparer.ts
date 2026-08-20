import type {
  ChatHostedToolSettings,
  Goal,
  ModelConfigInfo,
  RecipeConnectorProvider,
  SkillAvailability,
} from "@ngriffin_uk/polychat-schemas";

import {
  buildMemoryPromptContext,
  mergeEnabledMemoryToolNames,
  resolveMemoryPolicy,
} from "~/lib/chat/memoryPolicy";
import { messagesMatchStoredPrefix } from "~/lib/chat/messageComparison";
import { hasSnapshotPart } from "~/lib/chat/messageParts";
import { buildUserMessageData } from "~/lib/chat/mode-metadata";
import { toProviderMessages } from "~/lib/chat/providerMessages";
import { restoreStoredAttachmentContent } from "~/lib/chat/storedAttachments";
import type { ServiceContext } from "~/lib/context/serviceContext";
import { ConversationManager } from "~/lib/conversationManager";
import { Database } from "~/lib/database";
import { MemoryManager } from "~/lib/memory";
import { getSystemPrompt } from "~/lib/prompts";
import { buildGoalContractSection } from "~/lib/prompts/sections/goal";
import {
  getEmbeddingProvider,
  augmentPrompt,
} from "~/lib/providers/capabilities/embedding/helpers";
import { findModelConfig } from "~/lib/providers/models";
import type { DeferredToolSession } from "~/lib/tools/DeferredToolSession";
import { RepositoryManager } from "~/repositories";
import {
  getConnectedRecipeConnectorProviders,
  listRecipeConnectors,
} from "~/services/apps/connectors";
import { resolveEnabledFunctionToolNames } from "~/services/functions/availability";
import {
  buildSkillAvailabilityInput,
  createProjectSkillScope,
  listSkillAvailability,
  mergeSkillSuggestedToolNames,
  resolveSkillCatalog,
  resolvePersonalSkillScope,
  type RequestSkillScope,
} from "~/services/skills";
import {
  getModelToolDefinition,
  mergePersonalModelToolOptions,
  resolveModelToolConfigurations,
} from "~/services/tools/modelToolConfiguration";
import {
  applyProjectCodingEnvironment,
  resolveProjectChatContext,
  type ProjectChatContext,
} from "~/services/workspaces/chatContext";
import type { ChatMode, CoreChatOptions, MemoryScope, Message, Platform } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";
import { getLogger } from "~/utils/logger";
import { memoizeRequest } from "~/utils/requestCache";

import { getAllAttachments, pruneMessagesToFitContext, sanitiseInput } from "../utils";
import type { ValidationContext } from "../validation/ValidationPipeline";
import { collectLoadedToolNames, resolveToolLoading } from "./toolLoading";

const logger = getLogger({ prefix: "lib/chat/preparation/RequestPreparer" });

type ProviderModelConfig = NonNullable<Awaited<ReturnType<typeof findModelConfig>>>;

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
  primaryModelConfig: ModelConfigInfo;
  primaryProvider: string;
  conversationManager: ConversationManager;
  messages: Message[];
  systemPrompt: string;
  messageWithContext: string;
  userSettings: any;
  currentMode: ChatMode;
  isProUser: boolean;
  enabledTools: string[];
  tools?: Record<string, any>[];
  deferredTools?: DeferredToolSession;
  toolOptions?: ChatHostedToolSettings;
  requestOptions: CoreChatOptions["options"];
  memoryScope: MemoryScope;
  connectedConnectorProviders?: RecipeConnectorProvider[];
}

export class RequestPreparer {
  private repositories: RepositoryManager;
  private static modelConfigCache = new Map<string, Promise<ProviderModelConfig | null>>();

  constructor(private env: any) {
    this.repositories = new RepositoryManager(env);
  }

  public static clearModelConfigCache() {
    RequestPreparer.modelConfigCache.clear();
  }

  private static getCachedModelConfig(model: string, env: any, provider?: string, userId?: number) {
    const cacheKey = [userId ?? "anonymous", provider ?? "any", model].join(":");

    if (!RequestPreparer.modelConfigCache.has(cacheKey)) {
      const fetchPromise = (async () => {
        try {
          const config = await findModelConfig(model, env, provider, userId);

          if (!config) {
            RequestPreparer.modelConfigCache.delete(cacheKey);

            return null;
          }

          return config;
        } catch (error) {
          RequestPreparer.modelConfigCache.delete(cacheKey);
          throw error;
        }
      })();

      RequestPreparer.modelConfigCache.set(cacheKey, fetchPromise);
    }

    return RequestPreparer.modelConfigCache.get(cacheKey);
  }

  async prepare(
    options: CoreChatOptions,
    validationContext: ValidationContext,
  ): Promise<PreparedRequest> {
    const {
      sanitizedMessages,
      lastMessage,
      modelConfig: primaryModelConfig,
      messageWithContext,
    } = validationContext;

    if (!sanitizedMessages || !primaryModelConfig || !messageWithContext) {
      throw new AssistantError("Missing required validation context", ErrorType.PARAMS_ERROR);
    }

    const { platform = "api", anonymousUser, mode = "normal" } = options;
    const user = options.context?.user;
    const requestCache = options.context?.requestCache;
    const database = options.context?.database ?? new Database(this.env);
    const repositories = options.context?.repositories ?? database.repositories;
    const projectContext = options.context
      ? await resolveProjectChatContext(options.context, options)
      : null;
    const memoryScope: MemoryScope = projectContext
      ? { type: "project", projectId: projectContext.projectId }
      : { type: "personal" };

    options = { ...options, ...applyProjectCodingEnvironment(options, projectContext) };

    const isProUser = user?.plan_id === "pro";

    const userSettingsPromise = options.context?.getUserSettings
      ? options.context.getUserSettings()
      : user?.id
        ? memoizeRequest(requestCache, `user-settings:${user.id}`, () =>
            repositories.userSettings.getUserSettings(user.id),
          )
        : Promise.resolve(null);

    const modelConfigsPromise = this.buildModelConfigs(options, validationContext);
    const enabledFunctionTools = resolveEnabledFunctionToolNames(
      projectContext?.enabledTools ?? options.enabled_tools,
      user,
    );
    const connectedConnectorProvidersPromise =
      user?.id && options.context && enabledFunctionTools.has("use_recipe_connector")
        ? listRecipeConnectors({
            context: options.context,
            userId: user.id,
            requestUrl: options.app_url,
          })
            .then(({ connectors }) => getConnectedRecipeConnectorProviders(connectors))
            .catch((error) => {
              logger.warn("Failed to resolve connected recipe providers", {
                error,
                userId: user.id,
              });

              return [];
            })
        : Promise.resolve(undefined);
    const needsSavedToolConfiguration = options.enabled_tools?.some(
      (toolId) => getModelToolDefinition(toolId)?.requiresConfiguration,
    );
    const savedToolConfigurationsPromise =
      user?.id && !projectContext && needsSavedToolConfiguration
        ? repositories.capabilityConfigurations.list({ type: "user", id: user.id }, "tool")
        : Promise.resolve([]);
    const skillScopePromise = this.resolveSkillScope(
      projectContext,
      user?.id ? repositories : null,
      user?.id,
    );

    const finalMessagePromise = (async () => {
      const resolvedSettings = await userSettingsPromise;

      return this.processMessageContent(options, validationContext, resolvedSettings);
    })();

    const [
      modelConfigs,
      userSettings,
      finalMessage,
      savedToolConfigurations,
      connectedConnectorProviders,
    ] = await Promise.all([
      modelConfigsPromise,
      userSettingsPromise,
      finalMessagePromise,
      savedToolConfigurationsPromise,
      connectedConnectorProvidersPromise,
    ]);

    const memoryPolicy = resolveMemoryPolicy({ user, userSettings, store: options.store });

    const primaryModel = primaryModelConfig.matchingModel;
    const primaryProvider = primaryModelConfig.provider;

    assertBackgroundRequestIsSupported(options, primaryProvider);

    const conversationManager = ConversationManager.getInstance({
      database,
      repositories,
      user: user || undefined,
      anonymousUser: anonymousUser,
      model: primaryModel,
      platform,
      store: options.store,
      env: this.env,
      requestCache,
    });

    const shouldStoreMessages = options.store;
    const shouldAppendConversationHistory = options.conversation_history_write_mode === "append";
    const storeMessagesTask =
      shouldStoreMessages && !shouldAppendConversationHistory
        ? this.storeMessages(
            options,
            conversationManager,
            lastMessage,
            finalMessage,
            primaryModel,
            platform,
            mode,
          )
        : null;

    const skillScope = await skillScopePromise;
    const scopedSkillCatalog =
      options.context && (projectContext || user?.id)
        ? await resolveSkillCatalog(
            options.context,
            projectContext
              ? { type: "project", id: projectContext.projectId }
              : { type: "personal", id: user.id },
            projectContext ? new Set(projectContext.enabledSkillIds) : undefined,
          ).catch((error) => {
            logger.warn("Failed to load authored skills", {
              error,
              projectId: projectContext?.projectId,
              userId: user?.id,
            });

            return null;
          })
        : null;
    const skills = await listSkillAvailability(
      buildSkillAvailabilityInput({
        skillScope,
        supportsToolCalls: Boolean(primaryModelConfig.supportsToolCalls),
        enabledToolIds: new Set(projectContext?.enabledTools ?? options.enabled_tools ?? []),
      }),
      scopedSkillCatalog?.listDefinitions(),
    );

    const activeGoal = await this.loadActiveGoal(options);

    const enabledTools = projectContext?.enabledTools ?? options.enabled_tools;
    const toolOptions = projectContext
      ? projectContext.toolOptions
      : mergePersonalModelToolOptions({
          configured: resolveModelToolConfigurations(
            savedToolConfigurations.map((configuration) => ({
              toolId: configuration.capabilityId,
              configuration: configuration.configuration,
            })),
          ),
          requestedEnabledTools: enabledTools,
          requestedToolOptions: options.tool_options,
        });
    const resolvedEnabledTools = mergeSkillSuggestedToolNames({
      enabledTools: mergeEnabledMemoryToolNames({
        enabledTools,
        user,
        userSettings,
        store: options.store,
      }),
      skills,
    });
    const toolLoading = resolveToolLoading({
      options,
      enabledToolNames: resolvedEnabledTools,
      user,
      provider: primaryProvider,
      supportsToolCalls: Boolean(primaryModelConfig.supportsToolCalls),
      connectedConnectorProviders,
    });

    const systemPromptTask = this.buildSystemPrompt(
      options,
      sanitizedMessages,
      finalMessage,
      primaryModel,
      userSettings,
      memoryPolicy,
      projectContext,
      memoryScope,
      skills,
      activeGoal,
      toolLoading.deferredTools,
    );

    if (storeMessagesTask) {
      await storeMessagesTask;
    }

    const systemPrompt = await systemPromptTask;

    const messages = await this.buildProviderMessages({
      conversationManager,
      completionId: options.completion_id,
      shouldStoreMessages: shouldStoreMessages && !shouldAppendConversationHistory,
      fallbackMessages: sanitizedMessages,
      messageWithContext,
      primaryModelConfig,
    });

    toolLoading.deferredTools?.load(collectLoadedToolNames(messages));

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
      isProUser,
      enabledTools: resolvedEnabledTools,
      tools: toolLoading.tools,
      deferredTools: toolLoading.deferredTools,
      toolOptions,
      requestOptions: options.options,
      memoryScope,
      connectedConnectorProviders,
    };
  }

  private async resolveSkillScope(
    projectContext: ProjectChatContext | null,
    repositories: RepositoryManager | null,
    userId?: number,
  ): Promise<RequestSkillScope> {
    if (projectContext) {
      return createProjectSkillScope(projectContext.enabledSkillIds);
    }

    if (!repositories || !userId) {
      return { scope: "personal" };
    }

    try {
      return await resolvePersonalSkillScope(repositories.capabilityConfigurations, userId);
    } catch (error) {
      logger.warn("Failed to load personal skill configuration", { error, userId });

      return { scope: "personal" };
    }
  }

  private async buildModelConfigs(
    options: CoreChatOptions,
    validationContext: ValidationContext,
  ): Promise<ModelConfigInfo[]> {
    const { env, provider: requestedProvider } = options;
    const user = options.context?.user;
    const { selectedModels, modelConfig } = validationContext;
    const primaryModelConfig = modelConfig as ProviderModelConfig | undefined;

    if (!selectedModels || selectedModels.length === 0) {
      throw new AssistantError(
        "No selected models available from validation context",
        ErrorType.PARAMS_ERROR,
      );
    }

    const successfulConfigs: ModelConfigInfo[] = [];
    const seenModels = new Set<string>();
    const addConfig = (config: ProviderModelConfig | null) => {
      const modelKey = config ? `${config.provider}::${config.matchingModel}` : undefined;

      if (!config || !modelKey || seenModels.has(modelKey)) {
        return;
      }

      seenModels.add(modelKey);
      successfulConfigs.push({
        model: config.matchingModel,
        provider: config.provider,
        displayName: config.name || config.matchingModel,
      });
    };

    const shouldSkipPrimaryFetch = Boolean(primaryModelConfig) && selectedModels.length > 0;

    if (shouldSkipPrimaryFetch && primaryModelConfig) {
      addConfig(primaryModelConfig);
    }

    const modelsToFetch = shouldSkipPrimaryFetch ? selectedModels.slice(1) : selectedModels.slice();

    const configPromises = modelsToFetch.map((model) =>
      RequestPreparer.getCachedModelConfig(model, env, requestedProvider, user?.id),
    );
    const configResults = await Promise.allSettled(configPromises);

    configResults.forEach((result, index) => {
      if (result.status === "fulfilled" && result.value) {
        addConfig(result.value);
      } else {
        logger.warn("Failed to get model configuration", {
          model: modelsToFetch[index],
          error: result.status === "rejected" ? result.reason : "No config returned",
        });
      }
    });

    if (successfulConfigs.length === 0) {
      throw new AssistantError(
        "No valid model configurations available",
        ErrorType.CONFIGURATION_ERROR,
      );
    }

    return successfulConfigs;
  }

  private async processMessageContent(
    options: CoreChatOptions,
    validationContext: ValidationContext,
    userSettings: any,
  ): Promise<string> {
    const { lastMessage } = validationContext;
    const { use_rag, rag_options, env } = options;
    const user = options.context?.user;

    const lastMessageContent = Array.isArray(lastMessage!.content)
      ? lastMessage!.content
      : [{ type: "text" as const, text: lastMessage!.content as string }];

    const lastMessageContentText = lastMessageContent.find((c) => c.type === "text")?.text || "";

    const finalUserMessage = sanitiseInput(lastMessageContentText);

    if (use_rag) {
      const embedding = getEmbeddingProvider(env, user, userSettings);
      const augmentedPrompt = await augmentPrompt({
        provider: embedding,
        query: finalUserMessage,
        options: rag_options || {},
        env,
        user,
      });

      return augmentedPrompt ? `${finalUserMessage}\n\n${augmentedPrompt}` : finalUserMessage;
    }

    return finalUserMessage;
  }

  private async storeMessages(
    options: CoreChatOptions,
    conversationManager: ConversationManager,
    lastMessage: any,
    finalMessage: string,
    primaryModel: string,
    platform: Platform,
    mode: ChatMode,
  ): Promise<void> {
    const messageData = buildUserMessageData(options.options, options.background);

    const messageToStore: Message = {
      role: lastMessage.role,
      content: finalMessage,
      data: messageData,
      id: generateId(),
      timestamp: Date.now(),
      model: primaryModel,
      platform: platform || "api",
      mode,
    };

    const messagesToStore: Message[] = [messageToStore];

    const lastMessageContent = Array.isArray(lastMessage.content)
      ? lastMessage.content
      : [{ type: "text" as const, text: lastMessage.content as string }];

    const { allAttachments } = getAllAttachments(lastMessageContent);

    if (allAttachments.length > 0) {
      const attachmentMessage: Message = {
        role: lastMessage.role,
        content: "Attachments",
        data: { attachments: allAttachments },
        id: generateId(),
        timestamp: Date.now(),
        model: primaryModel,
        platform: platform || "api",
        mode: mode,
      };

      messagesToStore.push(attachmentMessage);
    }

    let existingMessages: Message[] | null = null;

    try {
      if (options.completion_id) {
        existingMessages = await conversationManager.get(options.completion_id);
      }
    } catch {
      // We can ignore this.
    }

    const incomingMessages = Array.isArray(options.messages) ? options.messages : [];
    const hasCompactedActiveHistory = existingMessages?.some(hasSnapshotPart) ?? false;
    const incomingHasSnapshot = incomingMessages.some(hasSnapshotPart);
    const latestExistingMessage = existingMessages?.at(-1);

    if (
      hasCompactedActiveHistory &&
      !incomingHasSnapshot &&
      latestExistingMessage?.role === lastMessage.role &&
      latestExistingMessage.content === finalMessage
    ) {
      return;
    }

    const canReplaceFromIncoming =
      incomingMessages.length > 0 && (!hasCompactedActiveHistory || incomingHasSnapshot);

    if (
      canReplaceFromIncoming &&
      existingMessages &&
      existingMessages.length > incomingMessages.length
    ) {
      await conversationManager.replaceMessages(options.completion_id, incomingMessages);

      return;
    }

    if (
      canReplaceFromIncoming &&
      existingMessages &&
      existingMessages.length === incomingMessages.length
    ) {
      if (messagesMatchStoredPrefix(existingMessages, incomingMessages)) {
        return;
      }

      await conversationManager.replaceMessages(options.completion_id, incomingMessages);

      return;
    }

    await conversationManager.addBatch(options.completion_id, messagesToStore, {
      metadata: options.metadata || {},
    });
  }

  private async buildSystemPrompt(
    options: CoreChatOptions,
    sanitizedMessages: Message[],
    finalMessage: string,
    primaryModel: string,
    userSettings: any,
    memoryPolicy: ReturnType<typeof resolveMemoryPolicy>,
    projectContext: ProjectChatContext | null,
    memoryScope: MemoryScope = { type: "personal" },
    skills?: readonly SkillAvailability[],
    activeGoal?: Goal | null,
    deferredTools?: DeferredToolSession,
  ): Promise<string> {
    const {
      system_prompt,
      mode = "normal",
      verbosity,
      reasoning_effort,
      max_tokens,
      location,
      completion_id,
    } = options;
    const user = options.context?.user;
    const memoriesEnabled = memoryPolicy.enabled;

    const currentMode = mode;

    if (currentMode === "no_system") {
      return this.appendProjectInstructions("", projectContext, activeGoal);
    }

    if (system_prompt) {
      const enhancedPrompt = await this.enhanceSystemPromptWithMemory(
        system_prompt,
        finalMessage,
        user,
        memoriesEnabled,
        userSettings,
        options.context,
        memoryScope,
      );

      return this.appendProjectInstructions(enhancedPrompt, projectContext, activeGoal);
    }

    const systemPromptFromMessages = sanitizedMessages.find((message) => message.role === "system");

    if (systemPromptFromMessages?.content && typeof systemPromptFromMessages.content === "string") {
      const enhancedPrompt = await this.enhanceSystemPromptWithMemory(
        systemPromptFromMessages.content,
        finalMessage,
        user,
        memoriesEnabled,
        userSettings,
        options.context,
        memoryScope,
      );

      return this.appendProjectInstructions(enhancedPrompt, projectContext, activeGoal);
    }

    const generatedPrompt = await getSystemPrompt(
      {
        completion_id: completion_id,
        input: finalMessage,
        model: primaryModel,
        provider: options.provider,
        date: new Date().toISOString().split("T")[0],
        location,
        mode: currentMode,
        verbosity,
        reasoning_effort,
        max_tokens,
        options: options.options,
      },
      primaryModel,
      user || undefined,
      userSettings,
      skills,
      { memory: memoryPolicy, deferredTools },
    );

    const enhancedPrompt = await this.enhanceSystemPromptWithMemory(
      generatedPrompt,
      finalMessage,
      user,
      memoriesEnabled,
      userSettings,
      options.context,
      memoryScope,
    );

    return this.appendProjectInstructions(enhancedPrompt, projectContext, activeGoal);
  }

  private async loadActiveGoal(options: CoreChatOptions): Promise<Goal | null> {
    const user = options.context?.user;

    if (!user?.id || user.plan_id !== "pro" || !options.completion_id) {
      return null;
    }

    try {
      return await options.context.repositories.goals.getActiveGoal({
        conversationId: options.completion_id,
      });
    } catch (error) {
      logger.error("Failed to load the active goal", { error });

      return null;
    }
  }

  private appendProjectInstructions(
    systemPrompt: string,
    projectContext: ProjectChatContext | null,
    activeGoal?: Goal | null,
  ): string {
    let prompt = systemPrompt;

    if (projectContext?.instructions) {
      const projectInstructions = `Project instructions:\n${projectContext.instructions}`;

      prompt = prompt ? `${prompt}\n\n${projectInstructions}` : projectInstructions;
    }

    if (activeGoal && activeGoal.status === "active") {
      const goalContract = buildGoalContractSection(activeGoal);

      prompt = prompt ? `${prompt}\n\n${goalContract}` : goalContract;
    }

    return prompt;
  }

  private async enhanceSystemPromptWithMemory(
    systemPrompt: string,
    finalMessage: string,
    user: any,
    memoriesEnabled: boolean,
    userSettings: any,
    serviceContext?: ServiceContext,
    memoryScope: MemoryScope = { type: "personal" },
  ): Promise<string> {
    const isProUser = user?.plan_id === "pro";

    if (memoriesEnabled && isProUser && finalMessage && user?.id) {
      try {
        const memoryManager = MemoryManager.getInstance(
          this.env,
          user,
          serviceContext,
          memoryScope,
        );
        const [synthesis, recentMemories] = await Promise.all([
          memoryScope.type === "personal"
            ? this.repositories.memorySyntheses.getActiveSynthesis(user.id, "global")
            : Promise.resolve(null),
          memoryManager.retrieveMemories(finalMessage, {
            topK: 3,
            scoreThreshold: 0.5,
            userSettings,
          }),
        ]);

        const memoryContext = buildMemoryPromptContext({
          synthesisText: synthesis?.synthesis_text,
          recentMemories,
        });

        if (memoryContext) {
          return systemPrompt ? `${systemPrompt}\n${memoryContext}` : memoryContext;
        }
      } catch (error) {
        logger.warn("Failed to retrieve memories", { error, userId: user?.id });
      }
    }

    return systemPrompt;
  }

  private buildFinalMessages(
    sanitizedMessages: Message[],
    messageWithContext: string,
    modelConfig: any,
  ): Message[] {
    const messagesWithAttachments = restoreStoredAttachmentContent(sanitizedMessages);
    const prunedWithAttachments =
      messagesWithAttachments.length > 0
        ? pruneMessagesToFitContext(messagesWithAttachments, messageWithContext, modelConfig)
        : [];

    const chatMessages = prunedWithAttachments.map((msg, index) => {
      if (index === prunedWithAttachments.length - 1) {
        if (Array.isArray(msg.content)) {
          return {
            ...msg,
            content: msg.content.map((part) =>
              part.type === "text" ? { ...part, text: messageWithContext } : part,
            ),
          };
        }

        return { ...msg, content: messageWithContext };
      }

      return msg;
    });

    return toProviderMessages(chatMessages).filter((msg) => msg.role !== "system");
  }

  private async buildProviderMessages({
    conversationManager,
    completionId,
    shouldStoreMessages,
    fallbackMessages,
    messageWithContext,
    primaryModelConfig,
  }: {
    conversationManager: ConversationManager;
    completionId?: string;
    shouldStoreMessages: boolean;
    fallbackMessages: Message[];
    messageWithContext: string;
    primaryModelConfig: ModelConfigInfo;
  }): Promise<Message[]> {
    if (!shouldStoreMessages || !completionId) {
      return this.buildFinalMessages(fallbackMessages, messageWithContext, primaryModelConfig);
    }

    try {
      const activeMessages = await conversationManager.get(completionId);

      if (Array.isArray(activeMessages) && activeMessages.length > 0) {
        const providerMessages = this.buildFinalMessages(
          activeMessages,
          messageWithContext,
          primaryModelConfig,
        );

        if (providerMessages.length > 0) {
          return providerMessages;
        }
      }

      throw new AssistantError(
        "Stored conversation has no active messages for provider context",
        ErrorType.PARAMS_ERROR,
      );
    } catch (error) {
      logger.warn("Failed to load active conversation messages for provider context", {
        error,
        completionId,
      });
      throw error;
    }
  }
}
