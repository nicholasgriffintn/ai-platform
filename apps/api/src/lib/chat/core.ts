import type {
  Attachment,
  ChatCompletionParameters,
  ChatRole,
  Message,
} from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { ConversationManager } from "../conversationManager";
import { Database } from "../database";
import { Embedding } from "../embedding";
import { Guardrails } from "../guardrails";
import { ModelRouter } from "../modelRouter";
import { getModelConfig } from "../models";
import { getSystemPrompt } from "../prompts";
import { getAIResponse } from "./responses";
import { createStreamWithPostProcessing } from "./streaming";
import { handleToolCalls } from "./tools";
import { checkContextWindowLimits } from "./utils";

type CoreChatOptions = ChatCompletionParameters & {
  isRestricted?: boolean;
};

export async function processChatRequest(options: CoreChatOptions) {
  try {
    const {
      platform = "api",
      app_url,
      system_prompt,
      env,
      user,
      disable_functions,
      completion_id,
      messages,
      model: requestedModel,
      mode = "normal",
      should_think,
      response_format,
      use_rag,
      rag_options,
      response_mode,
      budget_constraint,
      location,
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
    const imageAttachments: Attachment[] = lastMessageContent
      .filter(
        (
          c,
        ): c is {
          type: "image_url";
          image_url: { url: string; detail?: "auto" | "low" | "high" };
        } => c.type === "image_url" && "image_url" in c && !!c.image_url,
      )
      .map((c) => ({
        type: "image",
        url: c.image_url.url,
        detail: c.image_url.detail === "auto" ? undefined : c.image_url.detail,
      }));

    const documentAttachments: Attachment[] = lastMessageContent
      .filter(
        (
          c,
        ): c is {
          type: "document_url";
          document_url: { url: string; name?: string };
        } =>
          c.type === "document_url" && "document_url" in c && !!c.document_url,
      )
      .map((c) => ({
        type: "document",
        url: c.document_url.url,
        name: c.document_url.name,
      }));

    const markdownAttachments: Attachment[] = lastMessageContent
      .filter(
        (
          c,
        ): c is {
          type: "markdown_document";
          markdown_document: { markdown: string; name?: string };
        } =>
          c.type === "markdown_document" &&
          "markdown_document" in c &&
          !!c.markdown_document,
      )
      .map((c) => ({
        type: "markdown_document",
        markdown: c.markdown_document.markdown,
        name: c.markdown_document.name,
      }));

    const allAttachments = [
      ...imageAttachments,
      ...documentAttachments,
      ...markdownAttachments,
    ];

    const selectedModel =
      requestedModel ||
      (await ModelRouter.selectModel(
        env,
        lastMessageContentText,
        allAttachments,
        budget_constraint,
        user,
        completion_id,
      ));

    const modelConfig = getModelConfig(selectedModel);
    if (!modelConfig) {
      throw new AssistantError(
        `No matching model found for: ${selectedModel}`,
        ErrorType.PARAMS_ERROR,
      );
    }
    const matchedModel = modelConfig.matchingModel;

    const database = Database.getInstance(env);

    const conversationManager = ConversationManager.getInstance({
      database,
      userId: user?.id,
      model: matchedModel,
      platform,
      store,
    });

    const currentMode = mode;
    const finalUserMessage = lastMessageContentText;

    const userSettings = await database.getUserSettings(user?.id);

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

    checkContextWindowLimits(messages, messageWithContext, modelConfig);

    const guardrails = Guardrails.getInstance(env, user, userSettings);
    const inputValidation = await guardrails.validateInput(
      messageWithContext,
      user?.id,
      completion_id,
    );
    if (!inputValidation.isValid) {
      return {
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
      id: Math.random().toString(36).substring(2, 7),
      timestamp: Date.now(),
      model: matchedModel,
      platform: platform || "api",
      mode: currentMode,
    };

    const messagesToStore: Message[] = [messageToStore];

    if (allAttachments.length > 0) {
      const attachmentMessage: Message = {
        role: lastMessage.role,
        content: "Attachments",
        data: { attachments: allAttachments },
        id: Math.random().toString(36).substring(2, 7),
        timestamp: Date.now(),
        model: matchedModel,
        platform: platform || "api",
        mode: currentMode,
      };
      messagesToStore.push(attachmentMessage);
    }

    await conversationManager.addBatch(completion_id, messagesToStore);

    let systemMessage = "";

    if (currentMode !== "no_system") {
      if (system_prompt) {
        // Use the provided system prompt if available
        systemMessage = system_prompt;
      } else {
        // Check for system message in chat history
        const systemPromptFromMessages = messages.find(
          (message) => message.role === ("system" as ChatRole),
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
              completion_id,
              input: finalMessage,
              model: matchedModel,
              date: new Date().toISOString().split("T")[0],
              response_mode,
              location,
              mode: currentMode,
            },
            matchedModel,
            user?.id ? user : undefined,
            userSettings,
          );
        }
      }
    }

    const chatMessages = messages.map((msg, index) => {
      // Transform the last message if using RAG or has markdown attachments
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

    const fullChatMessages = chatMessages;

    const filteredChatMessages = fullChatMessages.filter(
      (msg) => msg.role !== ("system" as ChatRole),
    );

    const finalSystemMessage = currentMode === "no_system" ? "" : systemMessage;

    const response = await getAIResponse({
      app_url,
      system_prompt: finalSystemMessage,
      env,
      user: user?.id ? user : undefined,
      disable_functions,
      completion_id,
      messages: filteredChatMessages,
      message: messageWithContext,
      model: matchedModel,
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
          model: matchedModel,
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
        selectedModel: matchedModel,
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
      const outputValidation = await guardrails.validateOutput(
        response.response,
        user?.id,
        completion_id,
      );
      if (!outputValidation.isValid) {
        return {
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
            input: finalMessage,
            model: matchedModel,
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
      id: Math.random().toString(36).substring(2, 7),
      timestamp: Date.now(),
      model: matchedModel,
      platform: platform || "api",
      usage: response.usage || response.usageMetadata,
    });

    return {
      response,
      toolResponses,
      selectedModel: matchedModel,
      completion_id,
    };
  } catch (error) {
    console.error(error);
    throw error;
  }
}
