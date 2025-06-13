import { ConversationManager } from "~/lib/conversationManager";
import { Database } from "~/lib/database";
import { Embedding } from "~/lib/embedding";
import { Guardrails } from "~/lib/guardrails";
import { MemoryManager } from "~/lib/memory";
import { getModelConfig } from "~/lib/models";
import { getSystemPrompt } from "~/lib/prompts";
import type { ChatCompletionParameters, Message } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";
import { getLogger } from "~/utils/logger";
import { selectModels } from "./modelSelection";
import { getAIResponse } from "./responses";
import {
  createMultiModelStream,
  createStreamWithPostProcessing,
} from "./streaming";
import { handleToolCalls } from "./tools";
import {
  checkContextWindowLimits,
  getAllAttachments,
  pruneMessagesToFitContext,
  sanitiseInput,
  sanitiseMessages,
} from "./utils";

const logger = getLogger({ prefix: "CHAT_CORE" });

type CoreChatOptions = ChatCompletionParameters & {
  use_multi_model?: boolean;
  anonymousUser?: any;
  current_step?: number;
  max_steps?: number;
};

interface ModelConfigInfo {
  model: string;
  provider: string;
  displayName: string;
}

async function prepareRequestData(options: CoreChatOptions) {
  const {
    platform = "api",
    system_prompt,
    env,
    user,
    anonymousUser,
    messages: rawMessages,
    model: requestedModel,
    mode = "normal",
    use_rag,
    rag_options,
    response_mode,
    budget_constraint,
    location,
    use_multi_model = false,
  } = options;
  const isProUser = user?.plan_id === "pro";

  const sanitisedMessages = Array.isArray(rawMessages)
    ? sanitiseMessages(rawMessages)
    : [];
  if (sanitisedMessages.length === 0) {
    throw new AssistantError(
      "Messages array is empty or invalid",
      ErrorType.PARAMS_ERROR,
    );
  }

  if (!env.DB) {
    throw new AssistantError(
      "Missing DB binding",
      ErrorType.CONFIGURATION_ERROR,
    );
  }

  if (!user?.id && !anonymousUser?.id) {
    throw new AssistantError(
      "User or anonymousUser is required",
      ErrorType.PARAMS_ERROR,
    );
  }

  const lastMessage = sanitisedMessages[sanitisedMessages.length - 1] || null;
  if (!lastMessage) {
    throw new AssistantError(
      "No valid last message found",
      ErrorType.PARAMS_ERROR,
    );
  }
  const lastMessageContent = Array.isArray(lastMessage.content)
    ? lastMessage.content
    : [{ type: "text" as const, text: lastMessage.content as string }];

  const lastMessageContentText =
    lastMessageContent.find((c) => c.type === "text")?.text || "";

  const { markdownAttachments, allAttachments } =
    getAllAttachments(lastMessageContent);

  const database = Database.getInstance(env);

  const [userSettings, selectedModels] = await Promise.all([
    database.getUserSettings(user?.id),
    selectModels(
      env,
      lastMessageContentText,
      allAttachments,
      budget_constraint,
      user,
      options.completion_id,
      requestedModel,
      use_multi_model,
    ),
  ]);

  const primaryModelName = selectedModels[0];
  const primaryModelConfig = getModelConfig(primaryModelName, env);

  if (!primaryModelConfig) {
    throw new AssistantError(
      "Invalid model configuration",
      ErrorType.PARAMS_ERROR,
    );
  }

  const primaryModel = primaryModelConfig.matchingModel;
  const primaryProvider = primaryModelConfig?.provider;

  const modelConfigs: ModelConfigInfo[] = selectedModels.reduce(
    (configs, model) => {
      const config = getModelConfig(model, env);
      if (!config) {
        throw new AssistantError(
          "Invalid model configuration",
          ErrorType.PARAMS_ERROR,
        );
      }
      configs.push({
        model: config.matchingModel,
        provider: config.provider,
        displayName: config.name || config.matchingModel,
      });
      return configs;
    },
    [] as ModelConfigInfo[],
  );

  const conversationManager = ConversationManager.getInstance({
    database,
    user: user ? user : undefined,
    anonymousUser: anonymousUser,
    model: primaryModel,
    platform,
    store: options.store,
  });

  const currentMode = mode;
  const finalUserMessage = sanitiseInput(lastMessageContentText);

  const embedding = Embedding.getInstance(env, user, userSettings);
  
  let finalMessagePromise: Promise<string>;
  if (use_rag === true) {
    finalMessagePromise = embedding.augmentPrompt(
      finalUserMessage,
      rag_options,
      env,
      user?.id,
    );
  } else {
    finalMessagePromise = Promise.resolve(finalUserMessage);
  }

  const guardrails = Guardrails.getInstance(env, user, userSettings);

  const [finalMessage] = await Promise.all([finalMessagePromise]);

  const messageWithContext =
    markdownAttachments.length > 0
      ? `${finalMessage}\n\nContext from attached documents:\n${markdownAttachments
          .map((doc) => `${doc.name ? `# ${doc.name}\n` : ""}${doc.markdown}`)
          .join("\n\n")}`
      : finalMessage;

  const prunedWithAttachments =
    sanitisedMessages.length > 0
      ? pruneMessagesToFitContext(
          sanitisedMessages,
          messageWithContext,
          primaryModelConfig,
        )
      : [];
  checkContextWindowLimits(
    prunedWithAttachments,
    messageWithContext,
    primaryModelConfig,
  );

  const inputValidation = await guardrails.validateInput(
    messageWithContext,
    user?.id,
    options.completion_id,
  );

  if (!inputValidation.isValid) {
    return {
      selectedModel: primaryModel,
      validation: "input",
      error:
        inputValidation.rawResponse?.blockedResponse ||
        "Input did not pass safety checks",
      violations: inputValidation.violations,
      rawViolations: inputValidation.rawResponse,
    };
  }

  const messageToStore: Message = {
    role: lastMessage.role,
    content: finalMessage,
    id: generateId(),
    timestamp: Date.now(),
    model: primaryModel,
    platform: platform || "api",
    mode: currentMode,
  };

  const messagesToStore: Message[] = [messageToStore];

  if (allAttachments.length > 0) {
    const attachmentMessage: Message = {
      role: lastMessage.role,
      content: "Attachments",
      data: { attachments: allAttachments },
      id: generateId(),
      timestamp: Date.now(),
      model: primaryModel,
      platform: platform || "api",
      mode: currentMode,
    };
    messagesToStore.push(attachmentMessage);
  }

  await conversationManager.addBatch(options.completion_id, messagesToStore);

  let systemMessage = "";
  if (currentMode !== "no_system") {
    if (system_prompt) {
      systemMessage = system_prompt;
    } else {
      const systemPromptFromMessages = sanitisedMessages.find(
        (message) => message.role === "system",
      );

      if (
        systemPromptFromMessages?.content &&
        typeof systemPromptFromMessages.content === "string"
      ) {
        systemMessage = systemPromptFromMessages.content;
      } else {
        systemMessage = await getSystemPrompt(
          {
            completion_id: options.completion_id,
            input: finalMessage,
            model: primaryModel,
            date: new Date().toISOString().split("T")[0],
            response_mode,
            location,
            mode: currentMode,
          },
          primaryModel,
          user?.id ? user : undefined,
          userSettings,
        );
      }
    }
  }

  const memoriesEnabled =
    userSettings?.memories_save_enabled ||
    userSettings?.memories_chat_history_enabled;
  if (isProUser && memoriesEnabled) {
    const memoryManager = MemoryManager.getInstance(env, user);
    const recentMemories = finalUserMessage
      ? await memoryManager.retrieveMemories(finalUserMessage, {
          topK: 3,
          scoreThreshold: 0.5,
        })
      : [];
    if (recentMemories.length > 0) {
      const memoryBlock = `\n\nYou have access to the following long-term memories:\n<user_memories>\n${recentMemories
        .map((m) => `- ${m.text}`)
        .join("\n")}\n</user_memories>`;

      systemMessage = systemMessage
        ? `${systemMessage}\n\n${memoryBlock}`
        : memoryBlock;
    }
  }

  const chatMessages = prunedWithAttachments.map((msg, index) => ({
    ...msg,
    content:
      index === prunedWithAttachments.length - 1
        ? messageWithContext
        : msg.content,
  }));

  const filteredChatMessages = chatMessages.filter(
    (msg) => msg.role !== "system",
  );

  const finalSystemMessage = currentMode === "no_system" ? "" : systemMessage;

  return {
    modelConfigs,
    primaryModel,
    primaryProvider,
    selectedModel: primaryModel,
    selectedModels,
    conversationManager,
    messages: filteredChatMessages,
    systemPrompt: finalSystemMessage,
    messageWithContext,
    userSettings,
    currentMode,
  };
}

export async function processChatRequest(options: CoreChatOptions) {
  try {
    const {
      platform = "api",
      app_url,
      env,
      user,
      disable_functions,
      completion_id,
      should_think,
      response_format,
      lang,
      temperature,
      max_tokens,
      top_p,
      top_k,
      seed,
      repetition_penalty,
      frequency_penalty,
      presence_penalty,
      n,
      stream = false,
      stop,
      logit_bias,
      metadata,
      reasoning_effort,
      store = true,
      tools,
      parallel_tool_calls,
      tool_choice,
      enabled_tools = [],
      current_step,
      max_steps,
    } = options;

    const preparedData = await prepareRequestData(options);

    if ("validation" in preparedData) {
      return preparedData;
    }

    const {
      modelConfigs,
      primaryModel,
      conversationManager,
      messages,
      systemPrompt,
      messageWithContext,
      userSettings,
      currentMode,
      primaryProvider,
    } = preparedData;

    await conversationManager.checkUsageLimits(primaryModel);

    if (modelConfigs.length > 1 && stream) {
      const transformedStream = createMultiModelStream(
        {
          app_url,
          system_prompt: systemPrompt,
          env,
          user: user?.id ? user : undefined,
          disable_functions,
          completion_id,
          messages,
          message: messageWithContext,
          models: modelConfigs,
          mode: currentMode,
          should_think,
          response_format,
          lang,
          temperature,
          max_tokens,
          top_p,
          top_k,
          seed,
          repetition_penalty,
          frequency_penalty,
          presence_penalty,
          stop,
          logit_bias,
          metadata,
          reasoning_effort,
          store,
          enabled_tools,
          tools,
          parallel_tool_calls,
          tool_choice,
          current_step,
          max_steps,
        },
        {
          env,
          completion_id,
          model: primaryModel,
          provider: primaryProvider,
          platform: platform || "api",
          user,
          userSettings,
          app_url,
          mode: currentMode,
        },
        conversationManager,
      );

      return {
        stream: transformedStream,
        selectedModel: primaryModel,
        selectedModels: modelConfigs.map((m) => m.model),
        completion_id,
      };
    }

    const params = {
      app_url,
      system_prompt: systemPrompt,
      env,
      user: user?.id ? user : undefined,
      disable_functions,
      completion_id,
      messages,
      message: messageWithContext,
      model: primaryModel,
      mode: currentMode,
      should_think,
      response_format,
      lang,
      temperature,
      max_tokens,
      top_p,
      top_k,
      seed,
      repetition_penalty,
      frequency_penalty,
      presence_penalty,
      n,
      stream,
      stop,
      logit_bias,
      metadata,
      reasoning_effort,
      store,
      enabled_tools,
      tools,
      parallel_tool_calls,
      tool_choice,
      current_step,
      max_steps,
      provider: primaryProvider,
    };

    const response = await getAIResponse(params);

    if (response instanceof ReadableStream) {
      const transformedStream = await createStreamWithPostProcessing(
        response,
        params,
        conversationManager,
      );

      return {
        stream: transformedStream,
        selectedModel: primaryModel,
        completion_id,
      };
    }

    if (!response.response && !response.tool_calls) {
      throw new AssistantError(
        "No response generated by the model",
        ErrorType.PARAMS_ERROR,
      );
    }

    if (response.response) {
      const guardrails = Guardrails.getInstance(env, user, userSettings);
      const outputValidation = await guardrails.validateOutput(
        response.response,
        user?.id,
        completion_id,
      );
      if (!outputValidation.isValid) {
        return {
          selectedModel: primaryModel,
          validation: "output",
          error:
            outputValidation.rawResponse?.blockedResponse ||
            "Response did not pass safety checks",
          violations: outputValidation.violations,
          rawViolations: outputValidation.rawResponse,
        };
      }
    }

    const toolResponses: Message[] = [];
    if (response.tool_calls?.length > 0) {
      const toolResults = await handleToolCalls(
        completion_id,
        response,
        conversationManager,
        {
          env,
          request: {
            completion_id: completion_id,
            input: messageWithContext,
            model: primaryModel,
            date: new Date().toISOString().split("T")[0],
          },
          app_url,
          user: user?.id ? user : undefined,
        },
      );

      for (const result of toolResults) {
        toolResponses.push(result);
      }
    }

    await conversationManager.add(completion_id, {
      role: "assistant",
      content: response.response,
      citations: response.citations || null,
      data: response.data || null,
      log_id: env.AI.aiGatewayLogId || response.log_id,
      mode: currentMode,
      id: generateId(),
      timestamp: Date.now(),
      model: primaryModel,
      platform: platform || "api",
      usage: response.usage || response.usageMetadata,
      tool_calls: response.tool_calls || null,
    });

    return {
      response,
      toolResponses,
      selectedModel: primaryModel,
      selectedModels:
        modelConfigs.length > 1 ? modelConfigs.map((m) => m.model) : undefined,
      completion_id,
    };
  } catch (error: any) {
    logger.error("Error in processChatRequest", {
      error,
      completion_id: options.completion_id,
      model: options.model,
    });

    let errorType = ErrorType.UNKNOWN_ERROR;
    let errorMessage = "An unexpected error occurred";

    if (error instanceof AssistantError) {
      throw error;
    }

    if (
      error.name === "TimeoutError" ||
      error.message?.includes("timeout") ||
      error.message?.includes("network") ||
      error.code === "ECONNRESET" ||
      error.code === "ECONNABORTED"
    ) {
      errorType = ErrorType.NETWORK_ERROR;
      errorMessage =
        "Connection error or timeout while communicating with AI provider";
    } else if (
      error.status === 429 ||
      error.message?.includes("rate limit") ||
      error.message?.includes("too many requests")
    ) {
      errorType = ErrorType.RATE_LIMIT_ERROR;
      errorMessage = "Rate limit exceeded. Please try again later.";
    } else if (error.status === 401 || error.status === 403) {
      errorType = ErrorType.AUTHENTICATION_ERROR;
      errorMessage = "Authentication error with AI provider";
    } else if (
      error.message?.includes("model") ||
      error.message?.includes("parameter") ||
      error.message?.includes("token limit")
    ) {
      errorType = ErrorType.PROVIDER_ERROR;
      errorMessage =
        error.message || "Error with model parameters or token limits";
    } else if (error.status >= 500) {
      errorType = ErrorType.PROVIDER_ERROR;
      errorMessage = "AI provider server error. Please try again later.";
    }

    throw new AssistantError(errorMessage, errorType, error);
  }
}
