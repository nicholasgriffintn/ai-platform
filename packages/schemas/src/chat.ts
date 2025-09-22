import z from "zod/v4";

import { messageSchema } from "./shared";

export const chatCompletionResponseSchema = z.object({
  id: z.string(),
  object: z.string(),
  created: z.number(),
  model: z.string(),
  choices: z.array(
    z.object({
      index: z.number(),
      message: messageSchema,
      finish_reason: z.string().nullable(),
    }),
  ),
  usage: z
    .object({
      prompt_tokens: z.number(),
      completion_tokens: z.number(),
      total_tokens: z.number(),
    })
    .optional(),
  log_id: z.string().optional(),
});

export const countTokensJsonSchema = z.object({
  model: z.string().meta({
    description: "The model to use for token counting.",
  }),
  messages: z.array(z.any()).meta({
    description: "The messages to count tokens for.",
  }),
  system_prompt: z.string().optional().meta({
    description: "The system prompt to include in token count.",
  }),
});

export const countTokensResponseSchema = z.object({
  inputTokens: z.number().meta({
    description: "The number of input tokens.",
  }),
  model: z.string().meta({
    description: "The model used for token counting.",
  }),
});

export const createChatCompletionsJsonSchema = z.object({
  completion_id: z.string().optional().meta({
    description:
      "The ID of the completion to be used for future requests if stored.",
  }),
  model: z.string().optional().meta({
    description: "The model to use for the request.",
  }),
  mode: z
    .enum(["normal", "thinking", "no_system", "local", "remote", "agent"])
    .optional()
    .meta({
      description: "The mode of the chat completion.",
    }),
  should_think: z.boolean().optional().meta({
    description:
      "Whether to enable thinking mode for the model. (Used for Claude Sonnet 3.7).",
  }),
  use_multi_model: z
    .boolean()
    .optional()
    .describe(
      "Whether to use multiple models to generate the response when appropriate",
    ),
  messages: z
    .array(
      z.object({
        role: z
          .enum(["developer", "system", "user", "assistant", "tool"])
          .meta({
            description: "The role of the message author.",
          }),
        name: z.string().optional().meta({
          description: "The name of the message author.",
        }),
        content: z
          .union([
            z.string(),
            z.array(
              z
                .object({
                  type: z.enum([
                    "text",
                    "image_url",
                    "input_audio",
                    "document_url",
                    "markdown_document",
                  ]),
                  text: z.string().optional(),
                  document_url: z
                    .object({
                      url: z.url().meta({
                        description: "The URL of the document.",
                      }),
                      name: z.string().optional().meta({
                        description: "The name of the document.",
                      }),
                    })
                    .optional(),
                  markdown_document: z
                    .object({
                      markdown: z.string().meta({
                        description: "The markdown content of the document.",
                      }),
                    })
                    .optional(),
                  image_url: z
                    .object({
                      url: z.url().meta({
                        description:
                          "Either a URL for the image or the base64 encoded data for the image.",
                      }),
                      detail: z
                        .enum(["auto", "low", "high"])
                        .optional()
                        .prefault("auto")
                        .meta({
                          description: "The detail level of the image.",
                        }),
                    })
                    .optional(),
                  input_audio: z
                    .object({
                      data: z.string().optional().meta({
                        description: "Base64 encoded audio data.",
                      }),
                      format: z.enum(["wav", "mp3"]).optional(),
                    })
                    .optional(),
                })
                .refine(
                  (obj) => {
                    if (obj.type === "document_url") return !!obj.document_url;
                    if (obj.type === "image_url") return !!obj.image_url;
                    if (obj.type === "input_audio") return !!obj.input_audio;
                    if (obj.type === "markdown_document")
                      return !!obj.markdown_document;
                    return true;
                  },
                  {
                    path: ["type"],
                    error: "Field is required based on the specified type",
                  },
                ),
            ),
          ])
          .meta({
            description: "The contents of the message.",
          }),
        refusal: z.string().optional().meta({
          description: "The refusal reason if the message was refused.",
        }),
        tool_call_id: z.string().optional().meta({
          description: "Tool call that this message is responding to.",
        }),
        tool_call_arguments: z.any().optional().meta({
          description: "The arguments for the tool call.",
        }),
        tool_calls: z
          .array(
            z.object({
              id: z.string(),
              type: z.literal("function"),
              function: z.object({
                name: z.string(),
                arguments: z.string(),
              }),
            }),
          )
          .optional()
          .meta({
            description:
              "The tool calls generated by the model, such as function calls.",
          }),
        status: z.string().optional().meta({
          description: "The status of the message.",
        }),
        data: z.any().optional().meta({
          description: "Additional data for the message.",
        }),
      }),
    )
    .min(1, "messages array must not be empty")
    .meta({
      description: "A list of messages comprising the conversation so far.",
    }),
  temperature: z.number().min(0).max(2).prefault(0.8).optional().meta({
    description:
      "What sampling temperature to use, between 0 and 2. Higher values like 0.8 will make the output more random, while lower values like 0.2 will make it more focused and deterministic.",
  }),
  top_p: z.number().min(0).max(1).prefault(0.9).optional().meta({
    description:
      "An alternative to sampling with temperature, called nucleus sampling, where the model considers the results of the tokens with top_p probability mass. So 0.1 means only the tokens comprising the top 10% probability mass are considered. Don't specify both top_p and temperature.",
  }),
  top_k: z.number().min(1).max(100).optional().meta({
    description:
      "The number of top most likely tokens to consider for the model to sample from.",
  }),
  n: z.number().min(1).max(4).prefault(1).optional().meta({
    description:
      "How many chat completion choices to generate for each input message. Note that you will be charged based on the number of generated tokens across all of the choices. Keep n as 1 to minimize costs.",
  }),
  stream: z.boolean().optional().meta({
    description:
      "If set, partial message deltas will be sent. Tokens will be sent as data-only server-sent events as they become available, with the stream terminated by a data: [DONE].",
  }),
  stop: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .meta({
      description:
        "Up to 4 sequences where the model will stop generating further tokens. The returned text will not contain these sequences.",
    }),
  max_tokens: z.number().prefault(1024).optional().meta({
    description:
      "An upper bound for the number of tokens that can be generated for a completion, including visible output tokens and reasoning tokens.",
  }),
  presence_penalty: z.number().min(-2).max(2).prefault(0).optional().meta({
    description:
      "Positive values penalize new tokens based on whether they appear in the text so far, increasing the model's likelihood to talk about new topics.",
  }),
  frequency_penalty: z.number().min(-2).max(2).prefault(0).optional().meta({
    description:
      "The frequency penalty for the response. Positive values penalize new tokens based on their existing frequency in the text so far, decreasing the model's likelihood to repeat the same line verbatim.",
  }),
  logit_bias: z.record(z.string(), z.number()).optional().meta({
    description:
      "Modify the likelihood of specified tokens appearing in the response. The exact effect will vary per model, but values between -1 and 1 should decrease or increase likelihood of selection; values like -100 or 100 should result in a ban or exclusive selection of the relevant token.",
  }),
  user: z.string().optional().meta({
    description:
      "A unique identifier representing the user. If provided, the identifier will be included in the completion log.",
  }),
  seed: z.number().optional().meta({
    description:
      "A random seed for the completion. If provided, the seed will be included in the completion log.",
  }),
  metadata: z.record(z.string(), z.string()).optional().meta({
    description:
      "Set of key-value pairs that can be attached to a chat completion for tracking or display purposes. Both keys and values must be strings.",
  }),
  enabled_tools: z.array(z.string()).optional().meta({
    description: "The tools that should be enabled for this message.",
  }),
  tools: z
    .array(
      z.object({
        type: z.literal("function"),
        function: z.object({
          name: z.string(),
          description: z.string().optional(),
          parameters: z.record(z.string(), z.any()),
        }),
      }),
    )
    .optional()
    .meta({
      description:
        "A list of tools that the model can use to respond to the user's message.",
    }),
  tool_choice: z
    .union([
      z.literal("none"),
      z.literal("auto"),
      z.literal("required"),
      z.object({
        type: z.literal("function"),
        function: z.object({ name: z.string() }),
      }),
    ])
    .optional()
    .meta({
      description:
        "Controls which (if any) tool is called by the model. none means the model will not call any tool and instead generates a message. auto means the model can pick between generating a message or calling one or more tools. required means the model must call one or more tools. ",
    }),
  parallel_tool_calls: z.boolean().optional().meta({
    description: "Whether to enable parallel tool calls for the response.",
  }),
  reasoning_effort: z
    .enum(["low", "medium", "high"])
    .prefault("medium")
    .optional()
    .meta({
      description:
        "Constrains effort on reasoning for reasoning models. Reducing reasoning effort can result in faster responses and fewer tokens used on reasoning in a response. Only supported in certain reasoning models.",
    }),
  store: z.boolean().prefault(false).meta({
    description: "Whether to store the output of the completion.",
  }),
  response_format: z
    .object({
      type: z.enum(["json_schema"]),
      json_schema: z
        .object({
          name: z.string(),
          strict: z.boolean().prefault(true),
          schema: z.object({
            type: z.enum(["object"]),
            properties: z.record(z.string(), z.any()),
            required: z.array(z.string()),
            additionalProperties: z.boolean().prefault(false),
          }),
        })
        .optional(),
    })
    .optional()
    .meta({
      description: "The format of the response to be returned.",
    }),
  platform: z.enum(["web", "mobile", "api", "obsidian"]).optional().meta({
    description: "The platform the user is using to interact with the model.",
  }),
  budget_constraint: z.number().optional().meta({
    description:
      "The maximum amount of money the user is willing to spend on the completion.",
  }),
  response_mode: z
    .enum(["normal", "concise", "explanatory", "formal"])
    .optional()
    .meta({
      description:
        "The mode of the response. This will affect the style of the response from the model when using default system prompts.",
    }),
  use_rag: z.boolean().optional().meta({
    description: "Whether to use RAG to generate the response.",
  }),
  rag_options: z
    .object({
      topK: z.number().optional().meta({
        description: "The number of results to return from the RAG.",
      }),
      scoreThreshold: z.number().optional().meta({
        description: "The score threshold for the RAG.",
      }),
      includeMetadata: z.boolean().optional().meta({
        description: "Whether to include metadata in the RAG.",
      }),
      type: z.string().optional().meta({
        description: "The type of data to return from the RAG.",
      }),
      namespace: z.string().optional().meta({
        description: "The namespace of the RAG data to return.",
      }),
    })
    .optional()
    .meta({
      description: "The options for RAG.",
    }),
  max_steps: z.int().min(1).optional().meta({
    description:
      "Maximum number of sequential LLM calls (steps), e.g. when you use tool calls.",
  }),
});

export const getChatCompletionParamsSchema = z.object({
  completion_id: z.string().meta({
    description: "The ID of the chat completion to retrieve.",
  }),
});

export const generateChatCompletionTitleParamsSchema = z.object({
  completion_id: z.string().meta({
    description: "The ID of the chat completion to retrieve.",
  }),
});

export const generateChatCompletionTitleJsonSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant", "system", "tool", "developer"]),
        content: z.union([z.string(), z.array(z.any())]),
      }),
    )
    .optional(),
  store: z.boolean().optional(),
});

export const updateChatCompletionParamsSchema = z.object({
  completion_id: z.string().meta({
    description: "The ID of the chat completion to retrieve.",
  }),
});

export const updateChatCompletionJsonSchema = z
  .object({
    title: z.string().optional(),
    archived: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    error: "At least one field must be provided for update",
  });

export const deleteChatCompletionParamsSchema = z.object({
  completion_id: z.string().meta({
    description: "The ID of the chat completion to delete.",
  }),
});

export const checkChatCompletionParamsSchema = z.object({
  completion_id: z.string().min(1, "completion_id is required").meta({
    description: "The ID of the chat completion to retrieve.",
  }),
});

export const checkChatCompletionJsonSchema = z.object({
  role: z.enum(["user", "assistant", "tool"]).optional().meta({
    description: "The role of the message author to check.",
  }),
});

export const submitChatCompletionFeedbackParamsSchema = z.object({
  completion_id: z.string().min(1, "completion_id is required").meta({
    description: "The ID of the chat completion to retrieve.",
  }),
});

export const submitChatCompletionFeedbackJsonSchema = z.object({
  log_id: z.string().min(1, "log_id is required"),
  feedback: z.number(),
});

export const shareConversationParamsSchema = z.object({
  completion_id: z.string().min(1),
});

export const unshareConversationParamsSchema = z.object({
  completion_id: z.string().min(1),
});

export const getSharedConversationParamsSchema = z.object({
  share_id: z.string().min(1),
});

export const getChatCompletionResponseSchema = z.object({
  id: z.string(),
  title: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  model: z.string(),
  is_archived: z.boolean(),
  user_id: z.string().nullable(),
  share_id: z.string().nullable(),
  settings: z.record(z.string(), z.any()).optional(),
});

export const getChatCompletionMessagesResponseSchema = z.object({
  messages: z.array(messageSchema),
  conversation_id: z.string(),
});

export const getMessageResponseSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant", "system", "function"]),
  content: z.union([z.string(), z.array(z.any())]),
  name: z.string().optional(),
  function_call: z.any().optional(),
  timestamp: z.number().optional(),
  conversation_id: z.string(),
});
