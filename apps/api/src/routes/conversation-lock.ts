import {
  addConversationLockKeyJsonSchema,
  appendLockedMessagesJsonSchema,
  conversationLockKeyParamsSchema,
  conversationLockMutationResponseSchema,
  conversationLockParamsSchema,
  conversationLockResponseSchema,
  createConversationLockJsonSchema,
  deleteConversationLockJsonSchema,
  errorResponseSchema,
  listLockedMessagesResponseSchema,
} from "@ngriffin_uk/polychat-schemas";
import { type Context, Hono } from "hono";

import { getServiceContext } from "~/lib/context/serviceContext";
import { ResponseFactory } from "~/lib/http/ResponseFactory";
import { addRoute } from "~/lib/http/routeBuilder";
import {
  addConversationLockKey,
  appendLockedMessages,
  createConversationLock,
  deleteConversationLock,
  deleteConversationLockKey,
  getConversationLock,
  listLockedMessages,
} from "~/services/conversations/lock";

const app = new Hono();

const lockErrorResponses = {
  400: { description: "Bad request or validation error", schema: errorResponseSchema },
  403: { description: "Locked conversations require Pro", schema: errorResponseSchema },
  404: { description: "Conversation or lock not found", schema: errorResponseSchema },
};

function readCompletionId(context: Context): string {
  return (context.req.valid("param" as never) as { completion_id: string }).completion_id;
}

addRoute(app, "post", "/completions/:completion_id/lock", {
  tags: ["chat"],
  summary: "Lock a conversation",
  description:
    "Seal a conversation with client-held keys. The server keeps only wrapped keys and encrypted envelopes, and destroys every plaintext copy it holds.",
  auth: true,
  paramSchema: conversationLockParamsSchema,
  bodySchema: createConversationLockJsonSchema,
  responses: {
    200: { description: "The conversation lock", schema: conversationLockResponseSchema },
    ...lockErrorResponses,
    409: { description: "The conversation is already locked", schema: errorResponseSchema },
  },
  handler: async ({ raw, body }) => {
    const lock = await createConversationLock(
      getServiceContext(raw),
      readCompletionId(raw),
      body as never,
    );

    return ResponseFactory.success(raw, { lock });
  },
});

addRoute(app, "get", "/completions/:completion_id/lock", {
  tags: ["chat"],
  summary: "Get a conversation lock",
  description: "Return the wrapped keys needed to attempt an unlock on this device.",
  auth: true,
  paramSchema: conversationLockParamsSchema,
  responses: {
    200: { description: "The conversation lock", schema: conversationLockResponseSchema },
    ...lockErrorResponses,
  },
  handler: async ({ raw }) => {
    const lock = await getConversationLock(getServiceContext(raw), readCompletionId(raw));

    return ResponseFactory.success(raw, { lock });
  },
});

addRoute(app, "delete", "/completions/:completion_id/lock", {
  tags: ["chat"],
  summary: "Unlock a conversation",
  description:
    "Remove the lock and restore the plaintext the client decrypted. The sealed copy is dropped only once the plaintext is written.",
  auth: true,
  paramSchema: conversationLockParamsSchema,
  bodySchema: deleteConversationLockJsonSchema,
  responses: {
    200: { description: "Unlock result", schema: conversationLockMutationResponseSchema },
    ...lockErrorResponses,
  },
  handler: async ({ raw, body }) => {
    await deleteConversationLock(getServiceContext(raw), readCompletionId(raw), body as never);

    return ResponseFactory.success(raw, { success: true });
  },
});

addRoute(app, "post", "/completions/:completion_id/lock/keys", {
  tags: ["chat"],
  summary: "Add a key to a locked conversation",
  description: "Wrap the conversation key with another passkey or password.",
  auth: true,
  paramSchema: conversationLockParamsSchema,
  bodySchema: addConversationLockKeyJsonSchema,
  responses: {
    200: { description: "The conversation lock", schema: conversationLockResponseSchema },
    ...lockErrorResponses,
  },
  handler: async ({ raw, body }) => {
    const lock = await addConversationLockKey(
      getServiceContext(raw),
      readCompletionId(raw),
      (body as { key: never }).key,
    );

    return ResponseFactory.success(raw, { lock });
  },
});

addRoute(app, "delete", "/completions/:completion_id/lock/keys/:key_id", {
  tags: ["chat"],
  summary: "Remove a key from a locked conversation",
  description: "Stop one passkey or password from opening this conversation.",
  auth: true,
  paramSchema: conversationLockKeyParamsSchema,
  responses: {
    200: { description: "The conversation lock", schema: conversationLockResponseSchema },
    ...lockErrorResponses,
  },
  handler: async ({ raw }) => {
    const { completion_id, key_id } = raw.req.valid("param" as never) as {
      completion_id: string;
      key_id: string;
    };
    const lock = await deleteConversationLockKey(getServiceContext(raw), completion_id, key_id);

    return ResponseFactory.success(raw, { lock });
  },
});

addRoute(app, "get", "/completions/:completion_id/locked-messages", {
  tags: ["chat"],
  summary: "List encrypted messages",
  description: "Return the sealed envelopes for a locked conversation, oldest first.",
  auth: true,
  paramSchema: conversationLockParamsSchema,
  responses: {
    200: { description: "Encrypted messages", schema: listLockedMessagesResponseSchema },
    ...lockErrorResponses,
  },
  handler: async ({ raw }) => {
    const conversationId = readCompletionId(raw);
    const messages = await listLockedMessages(getServiceContext(raw), conversationId);

    return ResponseFactory.success(raw, { conversation_id: conversationId, messages });
  },
});

addRoute(app, "post", "/completions/:completion_id/locked-messages", {
  tags: ["chat"],
  summary: "Append encrypted messages",
  description: "Store sealed envelopes produced on the device for a locked conversation.",
  auth: true,
  paramSchema: conversationLockParamsSchema,
  bodySchema: appendLockedMessagesJsonSchema,
  responses: {
    200: { description: "Encrypted messages", schema: listLockedMessagesResponseSchema },
    ...lockErrorResponses,
  },
  handler: async ({ raw, body }) => {
    const conversationId = readCompletionId(raw);
    const { messages, title } = body as {
      messages: never[];
      title?: never;
    };
    const stored = await appendLockedMessages(
      getServiceContext(raw),
      conversationId,
      messages,
      title,
    );

    return ResponseFactory.success(raw, { conversation_id: conversationId, messages: stored });
  },
});

export default app;
