import {
  chatCompletionResponseSchema,
  editCompletionResponseSchema,
  countTokensJsonSchema,
  countTokensResponseSchema,
  createChatCompletionsJsonSchema,
  nextEditRequestSchema,
  applyEditRequestSchema,
  fillInMiddleRequestSchema,
  fillInMiddleResponseSchema,
  chatRunCommandReceiptResponseSchema,
  errorResponseSchema,
  type ChatCompletionRequestBody,
} from "@ngriffin_uk/polychat-schemas";
import {
  readNumericField,
  readRecordObjectField,
} from "@ngriffin_uk/polychat-utility-server/record-fields";
import type { Context, Hono } from "hono";
import z from "zod/v4";

import { requireCloudflareExecutionContext } from "~/infrastructure/cloudflare/execution-context";
import { getServiceContext } from "~/infrastructure/context/serviceContext";
import { ResponseFactory } from "~/infrastructure/http/ResponseFactory";
import { addRoute } from "~/infrastructure/http/routeBuilder";
import { sseResponse } from "~/infrastructure/http/streaming";
import { validateCaptcha } from "~/middleware/captchaMiddleware";
import { handleCountTokens } from "~/modules/completions/application/countTokens";
import { handleCreateApplyEditCompletions } from "~/modules/completions/application/createApplyEditCompletions";
import { handleCreateFimCompletions } from "~/modules/completions/application/createFimCompletions";
import { handleCreateNextEditCompletions } from "~/modules/completions/application/createNextEditCompletions";
import { prepareConversationCompletion } from "~/modules/conversations/application/completion-preparation";
import type { IEnv, IUser, Message } from "~/types";

function respondWithStreamOrJson(context: Context, result: unknown, stream?: boolean): Response {
  if (stream) {
    return sseResponse(result as ReadableStream);
  }

  return ResponseFactory.success(context, result);
}

export function registerCompletionCreationRoutes(app: Hono): void {
  addRoute(app, "post", "/completions", {
    tags: ["chat"],
    summary: "Create chat completion",
    description:
      "Creates a model response for the given chat conversation. Please note that parameter support can differ depending on the model used to generate the response.",
    bodySchema: createChatCompletionsJsonSchema,
    responses: {
      200: {
        description: "Chat completion response with model generation",
        schema: z.union([chatCompletionResponseSchema, chatRunCommandReceiptResponseSchema]),
      },
      400: {
        description: "Bad request or validation error",
        schema: errorResponseSchema,
      },
      401: { description: "Authentication error", schema: errorResponseSchema },
    },
    middleware: [validateCaptcha],
    handler: async ({ raw }) =>
      (async (context: Context) => {
        const body = context.req.valid("json" as never) as ChatCompletionRequestBody;

        const cfProperties = readRecordObjectField(context.req.raw, "cf");
        const response = await prepareConversationCompletion({
          context: getServiceContext(context),
          request: body,
          user: context.get("user"),
          anonymousUser: context.get("anonymousUser"),
          executionCtx: requireCloudflareExecutionContext(context.executionCtx),
          signal: context.req.raw.signal,
          location: {
            longitude: readNumericField(cfProperties, "longitude"),
            latitude: readNumericField(cfProperties, "latitude"),
          },
        });

        if (response instanceof Response) {
          return response;
        }

        return ResponseFactory.success(context, response);
      })(raw),
  });

  addRoute(app, "post", "/fim/completions", {
    tags: ["chat", "code"],
    summary: "Create fill-in-the-middle completion",
    description:
      "Generates code completions by filling the gap between a prefix and suffix using supported FIM models.",
    bodySchema: fillInMiddleRequestSchema,
    responses: {
      200: {
        description: "Fill-in-the-middle completion response",
        schema: fillInMiddleResponseSchema,
      },
      400: {
        description: "Bad request or validation error",
        schema: errorResponseSchema,
      },
      401: { description: "Authentication error", schema: errorResponseSchema },
    },
    middleware: [validateCaptcha],
    handler: async ({ raw }) =>
      (async (context: Context) => {
        const body = context.req.valid("json" as never) as z.infer<
          typeof fillInMiddleRequestSchema
        >;

        const result = await handleCreateFimCompletions({
          env: context.env as IEnv,
          user: context.get("user") as IUser | undefined,
          ...body,
        });

        return respondWithStreamOrJson(context, result, body.stream);
      })(raw),
  });

  addRoute(app, "post", "/edit/completions", {
    tags: ["chat", "code"],
    summary: "Create next edit completion",
    description: "Produces the next edit suggestion for a file using Mercury's code edit model.",
    bodySchema: nextEditRequestSchema,
    responses: {
      200: {
        description: "Edit suggestion response",
        schema: editCompletionResponseSchema,
      },
      400: {
        description: "Bad request or validation error",
        schema: errorResponseSchema,
      },
    },
    middleware: [validateCaptcha],
    handler: async ({ raw }) =>
      (async (context: Context) => {
        const body = context.req.valid("json" as never) as z.infer<typeof nextEditRequestSchema>;

        const result = await handleCreateNextEditCompletions({
          env: context.env as IEnv,
          user: context.get("user") as IUser | undefined,
          ...body,
        });

        return respondWithStreamOrJson(context, result, body.stream);
      })(raw),
  });

  addRoute(app, "post", "/apply/completions", {
    tags: ["chat", "code"],
    summary: "Apply edit completion",
    description: "Applies an edit snippet to existing code using Mercury's apply edit capability.",
    bodySchema: applyEditRequestSchema,
    responses: {
      200: {
        description: "Edit application response",
        schema: editCompletionResponseSchema,
      },
      400: {
        description: "Bad request or validation error",
        schema: errorResponseSchema,
      },
    },
    middleware: [validateCaptcha],
    handler: async ({ raw }) =>
      (async (context: Context) => {
        const body = context.req.valid("json" as never) as z.infer<typeof applyEditRequestSchema>;

        const result = await handleCreateApplyEditCompletions({
          env: context.env as IEnv,
          user: context.get("user") as IUser | undefined,
          ...body,
        });

        return respondWithStreamOrJson(context, result, body.stream);
      })(raw),
  });

  addRoute(app, "post", "/completions/count-tokens", {
    tags: ["chat"],
    summary: "Count tokens for a chat request",
    description:
      "Count the number of tokens that would be used for a chat completion request. Useful for estimating costs and staying within token limits.",
    bodySchema: countTokensJsonSchema,
    responses: {
      200: {
        description: "Token count result",
        schema: countTokensResponseSchema,
      },
      400: {
        description: "Bad request or validation error",
        schema: errorResponseSchema,
      },
      401: { description: "Authentication error", schema: errorResponseSchema },
    },
    middleware: [validateCaptcha],
    handler: async ({ raw }) =>
      (async (context: Context) => {
        const body = context.req.valid("json" as never) as {
          model: string;
          provider?: string;
          messages: Message[];
          system_prompt?: string;
        };

        const serviceContext = getServiceContext(context);

        const response = await handleCountTokens(serviceContext, body);

        return ResponseFactory.success(context, response);
      })(raw),
  });
}
