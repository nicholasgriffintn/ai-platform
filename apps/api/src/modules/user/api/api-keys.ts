import { apiKeyParamsSchema, createApiKeySchema, listPageOf } from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";

import { defineResource } from "~/infrastructure/http/resource";
import { ResponseFactory } from "~/infrastructure/http/ResponseFactory";
import {
  createUserApiKey,
  deleteUserApiKey,
  getUserApiKeys,
} from "~/modules/user/application/apiKeys";

const app = new Hono();

defineResource(app, { idParam: "api_key_id", tags: ["account"] }, (apiKeys) => {
  apiKeys
    .list({
      auth: true,
      summary: "List API keys",
      handler: async ({ serviceContext, user }) =>
        listPageOf(await getUserApiKeys(serviceContext, user.id), (key) => key.id),
    })
    .create({
      auth: true,
      summary: "Create an API key",
      description: "Returns the plaintext key once. Only its metadata is kept.",
      bodySchema: createApiKeySchema,
      handler: async ({ body, raw, serviceContext }) => {
        const { plaintextKey, metadata } = await createUserApiKey(serviceContext, body.name);

        return ResponseFactory.success(raw, { apiKey: plaintextKey, ...metadata }, 201);
      },
    })
    .delete({
      auth: true,
      summary: "Delete an API key",
      paramSchema: apiKeyParamsSchema,
      handler: async ({ params, serviceContext, user }) => {
        await deleteUserApiKey(serviceContext, params.api_key_id, user.id);

        return { deleted: true };
      },
    });
});

export default app;
