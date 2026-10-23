import {
  cancelResponseRequestSchema,
  compactConversationResponseSchema,
  compactResponseRequestSchema,
  createResponseRequestSchema,
  errorResponseSchema,
  isStoredItem,
  queuedChatMessageSchema,
  responseInputRequestSchema,
  responseInputTokensRequestSchema,
  responseInputTokensResponseSchema,
  responseListSchema,
  responseLookupQuerySchema,
  responseParamsSchema,
  responseReplayQuerySchema,
  responseReplayResponseSchema,
  responseSchema,
} from "@ngriffin_uk/polychat-schemas";
import {
  readNumericField,
  readRecordObjectField,
} from "@ngriffin_uk/polychat-utility-server/record-fields";
import { type Context, Hono, type Next } from "hono";
import z from "zod/v4";

import { requireCloudflareExecutionContext } from "~/infrastructure/cloudflare/execution-context";
import { defineResource } from "~/infrastructure/http/resource";
import { requireAgeCheck } from "~/middleware/ageGate";
import { allowRestrictedPaths } from "~/middleware/auth";
import { validateCaptcha } from "~/middleware/captchaMiddleware";
import { createRouteLogger } from "~/middleware/loggerMiddleware";
import { toApiMessages } from "~/modules/conversations/application/present";
import type { Message } from "~/types";

import { handleCompactChatCompletion } from "../application/compactChatCompletion";
import { handleCountTokens } from "../application/countTokens";
import { createResponse } from "../application/create";
import { submitResponseInput } from "../application/input";
import {
  cancelResponse,
  findResponseByIdempotencyKey,
  getResponse,
  replayResponseEvents,
} from "../application/read";

const app = new Hono();
const routeLogger = createRouteLogger("responses");

app.use("/*", async (context: Context, next: Next) => {
  routeLogger.info(`Processing responses route: ${context.req.path}`);

  await allowRestrictedPaths(context, next);
});

function requestLocation(raw: Context) {
  const cfProperties = readRecordObjectField(raw.req.raw, "cf");

  return {
    longitude: readNumericField(cfProperties, "longitude"),
    latitude: readNumericField(cfProperties, "latitude"),
  };
}

defineResource(app, { idParam: "response_id", tags: ["responses"] }, (responses) => {
  responses.create({
    summary: "Create a response",
    description:
      "Runs a model, teammate or agent against a conversation and returns the Response. Stream the sequenced event stream with stream: true, or resume a waiting response by naming it in response_id and supplying interaction or approval input items.",
    auth: "user-or-anonymous",
    bodySchema: createResponseRequestSchema,
    responses: {
      200: { description: "The response, or its event stream", schema: responseSchema },
      400: { description: "Bad request or validation error", schema: errorResponseSchema },
      401: { description: "Authentication error", schema: errorResponseSchema },
      403: { description: "Date of birth not confirmed", schema: errorResponseSchema },
    },
    middleware: [validateCaptcha, requireAgeCheck],
    handler: ({ serviceContext, body, user, anonymousUser, raw }) =>
      createResponse({
        context: serviceContext,
        request: body,
        user,
        anonymousUser,
        executionCtx: requireCloudflareExecutionContext(raw.executionCtx),
        signal: raw.req.raw.signal,
        location: requestLocation(raw),
        platform: raw.req.header("X-Platform"),
      }),
  });

  responses.list({
    auth: true,
    summary: "Find a response by idempotency key",
    description:
      "Returns the response accepted for an idempotency key, so a client that lost the create stream can find its response.",
    querySchema: responseLookupQuerySchema,
    responses: {
      200: { description: "The accepted response, if any", schema: responseListSchema },
      404: { description: "No response accepted for that key", schema: errorResponseSchema },
    },
    handler: ({ serviceContext, query }) =>
      findResponseByIdempotencyKey(serviceContext, query.idempotency_key),
  });

  responses.collectionAction("compact", {
    summary: "Compact a conversation",
    description: "Summarises older items so the next response fits the model context window.",
    auth: true,
    bodySchema: compactResponseRequestSchema,
    responses: {
      200: { description: "Compaction outcome", schema: compactConversationResponseSchema },
      404: { description: "Conversation not found", schema: errorResponseSchema },
    },
    handler: ({ serviceContext, body }) =>
      handleCompactChatCompletion(serviceContext, body.conversation),
  });

  responses.collectionAction("input_tokens", {
    auth: "user-or-anonymous",
    summary: "Count input tokens",
    description: "Counts the tokens a model would read for the given input and instructions.",
    bodySchema: responseInputTokensRequestSchema,
    responses: {
      200: { description: "Token count", schema: responseInputTokensResponseSchema },
      400: { description: "Bad request or validation error", schema: errorResponseSchema },
    },
    middleware: [validateCaptcha],
    handler: async ({ serviceContext, body }) => {
      const messages: Message[] =
        typeof body.input === "string"
          ? [{ role: "user", content: body.input }]
          : toApiMessages(body.input.filter(isStoredItem));
      const counted = await handleCountTokens(serviceContext, {
        model: body.model,
        provider: body.provider,
        messages,
        system_prompt: body.instructions,
      });

      return { input_tokens: counted.inputTokens, model: counted.model };
    },
  });

  responses.read({
    auth: true,
    summary: "Get a response",
    description: "Returns the authoritative state of a response with its output items.",
    paramSchema: responseParamsSchema,
    responses: {
      200: { description: "The response", schema: responseSchema },
      404: { description: "Response not found", schema: errorResponseSchema },
    },
    handler: ({ serviceContext, params }) => getResponse(serviceContext, params.response_id),
  });

  responses.sub("events", "event_id").list({
    auth: true,
    summary: "Replay response events",
    description:
      "Returns the ordered lifecycle events after a cursor, or a snapshot when the cursor can no longer be served.",
    paramSchema: responseParamsSchema,
    querySchema: responseReplayQuerySchema,
    responses: {
      200: {
        description: "Ordered events or a snapshot reset",
        schema: responseReplayResponseSchema,
      },
      404: { description: "Response not found", schema: errorResponseSchema },
    },
    handler: ({ serviceContext, params, query }) =>
      replayResponseEvents(serviceContext, params.response_id, query),
  });

  responses.action("input", {
    auth: true,
    summary: "Send input to a response",
    description:
      "Answers a question, resolves an approval or steers a response in progress. Set when to after to queue a user message for when the response finishes.",
    paramSchema: responseParamsSchema,
    bodySchema: responseInputRequestSchema,
    responses: {
      200: {
        description: "The continued response, its event stream, or the queued item",
        schema: z.union([
          responseSchema,
          z.object({ object: z.literal("queued_item"), queued: queuedChatMessageSchema }),
        ]),
      },
      403: { description: "Date of birth not confirmed", schema: errorResponseSchema },
      404: { description: "Response not found", schema: errorResponseSchema },
      409: { description: "Too many queued items", schema: errorResponseSchema },
    },
    middleware: [requireAgeCheck],
    handler: ({ serviceContext, params, body, user, anonymousUser, raw }) =>
      submitResponseInput({
        context: serviceContext,
        responseId: params.response_id,
        request: body,
        user,
        anonymousUser,
        executionCtx: requireCloudflareExecutionContext(raw.executionCtx),
        signal: raw.req.raw.signal,
        platform: raw.req.header("X-Platform"),
      }),
  });

  responses.action("cancel", {
    auth: true,
    summary: "Cancel a response",
    paramSchema: responseParamsSchema,
    bodySchema: cancelResponseRequestSchema,
    responses: {
      200: { description: "Cancellation accepted", schema: responseSchema },
      404: { description: "Response not found", schema: errorResponseSchema },
      409: { description: "Response attempt changed", schema: errorResponseSchema },
    },
    handler: ({ serviceContext, params, body, raw }) =>
      cancelResponse(serviceContext, params.response_id, body, raw.req.header("X-Platform")),
  });
});

export default app;
