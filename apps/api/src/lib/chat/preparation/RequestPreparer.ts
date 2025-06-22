import { ConversationManager } from "~/lib/conversationManager";
import { Database } from "~/lib/database";
import { Embedding } from "~/lib/embedding";
import { MemoryManager } from "~/lib/memory";
import { getModelConfig } from "~/lib/models";
import { getSystemPrompt } from "~/lib/prompts";
import type { ChatMode, Message, Platform } from "~/types";
import type { CoreChatOptions } from "~/types";
import { generateId } from "~/utils/id";
import { getLogger } from "~/utils/logger";

import { getAllAttachments, sanitiseInput } from "../utils";
import type { ValidationContext } from "../validation/ValidationPipeline";

const logger = getLogger({ prefix: "CHAT_REQUEST_PREPARER" });

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
  currentMode: string;
  isProUser: boolean;
}

interface ModelConfigInfo {
  model: string;
  provider: string;
  displayName: string;
}

export class RequestPreparer {
  private database: Database;

  constructor(private env: any) {
    this.database = Database.getInstance(env);
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
      throw new Error("Missing required validation context");
    }

    const { platform = "api", user, anonymousUser, mode = "normal" } = options;

    const isProUser = user?.plan_id === "pro";

    const userSettings = await this.database.getUserSettings(user?.id);

    const modelConfigs = await this.buildModelConfigs(
      options,
      validationContext,
    );

    const primaryModel = primaryModelConfig.matchingModel;
    const primaryProvider = primaryModelConfig.provider;

    const conversationManager = ConversationManager.getInstance({
      database: this.database,
      user: user || undefined,
      anonymousUser: anonymousUser,
      model: primaryModel,
      platform,
      store: options.store,
    });

    const finalMessage = await this.processMessageContent(
      options,
      validationContext,
      userSettings,
    );

    await this.storeMessages(
      options,
      conversationManager,
      lastMessage!,
      finalMessage,
      primaryModel,
      platform,
      mode,
    );

    const systemPrompt = await this.buildSystemPrompt(
      options,
      sanitizedMessages!,
      finalMessage,
      primaryModel,
      userSettings,
    );

    const messages = this.buildFinalMessages(
      sanitizedMessages!,
      messageWithContext,
      primaryModelConfig,
    );

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
    };
  }

  private async buildModelConfigs(
    options: CoreChatOptions,
    validationContext: ValidationContext,
  ): Promise<ModelConfigInfo[]> {
    const { env } = options;

    const selectedModels = validationContext.selectedModels;

    if (!selectedModels || selectedModels.length === 0) {
      throw new Error("No selected models available from validation context");
    }

    const modelConfigs: ModelConfigInfo[] = [];
    for (const model of selectedModels) {
      const config = await getModelConfig(model, env);
      if (!config) {
        throw new Error(`Invalid model configuration for ${model}`);
      }
      modelConfigs.push({
        model: config.matchingModel,
        provider: config.provider,
        displayName: config.name || config.matchingModel,
      });
    }

    return modelConfigs;
  }

  private async processMessageContent(
    options: CoreChatOptions,
    validationContext: ValidationContext,
    userSettings: any,
  ): Promise<string> {
    const { lastMessage } = validationContext;
    const { use_rag, rag_options, env, user } = options;

    const lastMessageContent = Array.isArray(lastMessage!.content)
      ? lastMessage!.content
      : [{ type: "text" as const, text: lastMessage!.content as string }];

    const lastMessageContentText =
      lastMessageContent.find((c) => c.type === "text")?.text || "";

    const finalUserMessage = sanitiseInput(lastMessageContentText);

    if (use_rag === true) {
      const embedding = Embedding.getInstance(env, user, userSettings);
      return embedding.augmentPrompt(
        finalUserMessage,
        rag_options,
        env,
        user?.id,
      );
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
    const messageToStore: Message = {
      role: lastMessage.role,
      content: finalMessage,
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

    await conversationManager.addBatch(options.completion_id, messagesToStore);
  }

  private async buildSystemPrompt(
    options: CoreChatOptions,
    sanitizedMessages: Message[],
    finalMessage: string,
    primaryModel: string,
    userSettings: any,
  ): Promise<string> {
    const {
      system_prompt,
      mode = "normal",
      response_mode,
      location,
      completion_id,
      user,
    } = options;

    const currentMode = mode;

    if (currentMode === "no_system") {
      return "";
    }

    if (system_prompt) {
      return this.enhanceSystemPromptWithMemory(
        system_prompt,
        finalMessage,
        user,
        userSettings,
      );
    }

    const systemPromptFromMessages = sanitizedMessages.find(
      (message) => message.role === "system",
    );

    if (
      systemPromptFromMessages?.content &&
      typeof systemPromptFromMessages.content === "string"
    ) {
      return this.enhanceSystemPromptWithMemory(
        systemPromptFromMessages.content,
        finalMessage,
        user,
        userSettings,
      );
    }

    const generatedPrompt = await getSystemPrompt(
      {
        completion_id: completion_id!,
        input: finalMessage,
        model: primaryModel,
        date: new Date().toISOString().split("T")[0]!,
        response_mode,
        location,
        mode: currentMode,
      },
      primaryModel,
      user || undefined,
      userSettings,
    );

    return this.enhanceSystemPromptWithMemory(
      generatedPrompt,
      finalMessage,
      user,
      userSettings,
    );
  }

  private async enhanceSystemPromptWithMemory(
    systemPrompt: string,
    finalMessage: string,
    user: any,
    userSettings: any,
  ): Promise<string> {
    const isProUser = user?.plan_id === "pro";
    const memoriesEnabled =
      userSettings?.memories_save_enabled ||
      userSettings?.memories_chat_history_enabled;

    if (isProUser && memoriesEnabled && finalMessage) {
      try {
        const memoryManager = MemoryManager.getInstance(this.env, user);
        const recentMemories = await memoryManager.retrieveMemories(
          finalMessage,
          {
            topK: 3,
            scoreThreshold: 0.5,
          },
        );

        if (recentMemories.length > 0) {
          const memoryBlock = `\n\nYou have access to the following long-term memories:\n<user_memories>\n${recentMemories
            .map((m) => `- ${m.text}`)
            .join("\n")}\n</user_memories>`;

          return systemPrompt
            ? `${systemPrompt}\n\n${memoryBlock}`
            : memoryBlock;
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
    const { pruneMessagesToFitContext } = require("../utils");

    const prunedWithAttachments =
      sanitizedMessages.length > 0
        ? pruneMessagesToFitContext(
            sanitizedMessages,
            messageWithContext,
            modelConfig,
          )
        : [];

    const chatMessages = prunedWithAttachments.map((msg, index) => ({
      ...msg,
      content:
        index === prunedWithAttachments.length - 1
          ? messageWithContext
          : msg.content,
    }));

    return chatMessages.filter((msg) => msg.role !== "system");
  }
}
