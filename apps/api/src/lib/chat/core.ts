import type { ChatCompletionParameters, ChatRole, Message } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";
import { getLogger } from "~/utils/logger";
import { ConversationManager } from "../conversationManager";
import { Database } from "../database";
import { Embedding } from "../embedding";
import { Guardrails } from "../guardrails";
import { getModelConfig } from "../models";
import { getSystemPrompt } from "../prompts";
import { selectModels } from "./modelSelection";
import { getAIResponse } from "./responses";
import {
  createMultiModelStream,
  createStreamWithPostProcessing,
} from "./streaming";
import { handleToolCalls } from "./tools";
import { checkContextWindowLimits, getAllAttachments } from "./utils";

const logger = getLogger({ prefix: "CHAT_CORE" });

type CoreChatOptions = ChatCompletionParameters & {
  isRestricted?: boolean;
  useMultiModel?: boolean;
};

interface ModelConfigInfo {
  model: string;
  provider: string;
  displayName: string;
}

const SYSTEM_ROLE: ChatRole = "system" as ChatRole;

async function prepareRequestData(options: CoreChatOptions) {
  const {
    platform = "api",
    system_prompt,
    env,
    user,
    messages,
    model: requestedModel,
    mode = "normal",
    use_rag,
    rag_options,
    response_mode,
    budget_constraint,
    location,
    useMultiModel = false,
  } = options;

  if (!env.DB) {
    throw new AssistantError(
      "Missing DB binding",
      ErrorType.CONFIGURATION_ERROR,
    );
  }

  const lastMessage = messages[messages.length - 1];
  const lastMessageContent = Array.isArray(lastMessage.content)
    ? lastMessage.content
    : [{ type: "text" as const, text: lastMessage.content as string }];

  const lastMessageContentText =
    lastMessageContent.find((c) => c.type === "text")?.text || "";

  const { markdownAttachments, allAttachments } =
    getAllAttachments(lastMessageContent);

  const database = Database.getInstance(env);
  const userSettings = await database.getUserSettings(user?.id);

  // Determine which models to use (single- or multi-model)
  const selectedModels = await selectModels(
    env,
    lastMessageContentText,
    allAttachments,
    budget_constraint,
    user,
    options.completion_id,
    requestedModel,
    useMultiModel,
  );

  const primaryModelName = selectedModels[0];
  const primaryModelConfig = getModelConfig(primaryModelName);

  if (!primaryModelConfig) {
    throw new AssistantError(
      "Invalid model configuration",
      ErrorType.PARAMS_ERROR,
    );
  }

  const primaryModel = primaryModelConfig.matchingModel;

  const modelConfigs: ModelConfigInfo[] = selectedModels.map((model) => {
    const config = getModelConfig(model);
    if (!config) {
      throw new AssistantError(
        "Invalid model configuration",
        ErrorType.PARAMS_ERROR,
      );
    }
    return {
      model: config.matchingModel,
      provider: config.provider,
      displayName: config.name || config.matchingModel,
    };
  });

  const conversationManager = ConversationManager.getInstance({
    database,
    userId: user?.id,
    model: primaryModel,
    platform,
    store: options.store,
  });

  const currentMode = mode;
  const finalUserMessage = lastMessageContentText;

  checkContextWindowLimits(messages, finalUserMessage, primaryModelConfig);

  const embedding = Embedding.getInstance(env, user, userSettings);

  const finalMessage =
    use_rag === true
      ? await embedding.augmentPrompt(
          finalUserMessage,
          rag_options,
          env,
          user?.id,
        )
      : finalUserMessage;

  const messageWithContext =
    markdownAttachments.length > 0
      ? `${finalMessage}\n\nContext from attached documents:\n${markdownAttachments
          .map((doc) => `${doc.name ? `# ${doc.name}\n` : ""}${doc.markdown}`)
          .join("\n\n")}`
      : finalMessage;

  checkContextWindowLimits(messages, messageWithContext, primaryModelConfig);

  const guardrails = Guardrails.getInstance(env, user, userSettings);
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
      // Use the provided system prompt if available
      systemMessage = system_prompt;
    } else {
      // Check for system message in chat history
      const systemPromptFromMessages = messages.find(
        (message) => message.role === SYSTEM_ROLE,
      );

      if (
        systemPromptFromMessages?.content &&
        typeof systemPromptFromMessages.content === "string"
      ) {
        systemMessage = systemPromptFromMessages.content;
      } else {
        // Generate a default system prompt if none provided
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

  const chatMessages = messages.map((msg, index) => {
    if (index === messages.length - 1) {
      let messageText = msg.content;

      // Use RAG-augmented message if RAG is enabled
      if (use_rag) {
        messageText = finalMessage;
      }

      // Use message with markdown context if markdown attachments exist
      if (markdownAttachments.length > 0) {
        messageText = messageWithContext;
      }

      return {
        ...msg,
        content: messageText,
      };
    }
    return msg;
  });

  const filteredChatMessages = chatMessages.filter(
    (msg) => msg.role !== SYSTEM_ROLE,
  );

  const finalSystemMessage = currentMode === "no_system" ? "" : systemMessage;

  return {
    modelConfigs,
    primaryModel,
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
      enabled_tools = [],
      isRestricted,
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
    } = preparedData;

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
        },
        {
          env,
          completion_id,
          model: primaryModel,
          platform: platform || "api",
          user,
          userSettings,
          app_url,
          mode: currentMode,
          isRestricted,
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

    const response = await getAIResponse({
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
    });

    if (response instanceof ReadableStream) {
      const transformedStream = await createStreamWithPostProcessing(
        response,
        {
          env,
          completion_id,
          model: primaryModel,
          platform: platform || "api",
          user,
          userSettings,
          app_url,
          mode: currentMode,
          isRestricted,
        },
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
    if (response.tool_calls?.length > 0 && !isRestricted) {
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
        isRestricted,
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
    });

    return {
      response,
      toolResponses,
      selectedModel: primaryModel,
      selectedModels:
        modelConfigs.length > 1 ? modelConfigs.map((m) => m.model) : undefined,
      completion_id,
    };
  } catch (error) {
    logger.error("Error in processChatRequest", {
      error,
      completion_id: options.completion_id,
      model: options.model,
    });
    throw error;
  }
}
