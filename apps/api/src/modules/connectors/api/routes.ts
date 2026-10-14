import {
  listPageOf,
  recipeConnectorAccountSchema,
  recipeConnectorAccountUpdateRequestSchema,
  recipeConnectorApiKeyRequestSchema,
  recipeConnectorListQuerySchema,
  recipeConnectorManifestSchema,
  recipeConnectorProviderSchema,
  recipeConnectorStartRequestSchema,
  recipeConnectorStartResponseSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";
import z from "zod/v4";

import { defineResource } from "~/infrastructure/http/resource";

import {
  deleteRecipeConnectorConnection,
  getRecipeConnector,
  listRecipeConnectorSummaries,
  startRecipeConnectorAuthorization,
  storeRecipeConnectorApiKey,
  verifyComposioConnectorAuthorization,
} from "../application";
import { listRecipeConnectorAccounts, updateRecipeConnectorAccount } from "../application/accounts";

const app = new Hono();
const connectorParamsSchema = z.object({ connector_id: recipeConnectorProviderSchema });
const accountParamsSchema = connectorParamsSchema.extend({
  account_id: z.string().min(1).max(240),
});
const composioCallbackQuerySchema = z.union([
  z.object({ session_uri: z.string().min(1).max(4096) }),
  z
    .object({
      status: z.enum(["success", "failed"]),
      connected_account_id: z.string().min(1).max(256).optional(),
    })
    .refine((query) => query.status !== "success" || query.connected_account_id != null, {
      message: "connected_account_id is required for a successful connection",
      path: ["connected_account_id"],
    }),
]);

app.use("/composio_callback", async (context, next) => {
  context.header("Cache-Control", "no-store");
  await next();
  context.header("Cache-Control", "no-store");
});

defineResource(app, { idParam: "connector_id", tags: ["connectors"] }, (connectors) => {
  connectors
    .list({
      auth: true,
      summary: "List connectors",
      description: "Summaries without operations. Read a connector for its operations.",
      querySchema: recipeConnectorListQuerySchema,
      handler: async ({ query, serviceContext, user }) =>
        listPageOf(
          await listRecipeConnectorSummaries({
            context: serviceContext,
            userId: user.id,
            status: query.status,
          }),
          (connector) => connector.id,
        ),
    })
    .read({
      auth: true,
      summary: "Get a connector",
      paramSchema: connectorParamsSchema,
      responses: { 200: { description: "Connector", schema: recipeConnectorManifestSchema } },
      handler: ({ params, serviceContext, user }) =>
        getRecipeConnector({
          context: serviceContext,
          userId: user.id,
          provider: params.connector_id,
        }),
    })
    .view("composio_callback", {
      auth: true,
      summary: "Complete a Composio connection",
      description: "The browser lands here after Composio authorisation and is redirected back.",
      querySchema: composioCallbackQuerySchema,
      handler: async ({ raw, query, serviceContext, user }) => {
        const redirectUrl = await verifyComposioConnectorAuthorization({
          context: serviceContext,
          userId: user.id,
          ...("session_uri" in query
            ? { sessionUri: query.session_uri }
            : { status: query.status, connectedAccountId: query.connected_account_id }),
        });

        raw.header("Cross-Origin-Opener-Policy", "unsafe-none");

        return raw.redirect(redirectUrl);
      },
    })
    .delete({
      auth: true,
      summary: "Disconnect a connector",
      paramSchema: connectorParamsSchema,
      handler: ({ params, serviceContext, user }) =>
        deleteRecipeConnectorConnection({
          context: serviceContext,
          userId: user.id,
          provider: params.connector_id,
        }),
    })
    .action("connect", {
      auth: true,
      summary: "Start connector authorisation",
      paramSchema: connectorParamsSchema,
      bodySchema: recipeConnectorStartRequestSchema,
      responses: {
        200: { description: "Authorisation URL", schema: recipeConnectorStartResponseSchema },
      },
      handler: ({ raw, params, body, serviceContext, user }) =>
        startRecipeConnectorAuthorization({
          context: serviceContext,
          userId: user.id,
          provider: params.connector_id,
          authConfigId: body.authConfigId,
          returnTo: body.returnTo,
          requestUrl: raw.req.url,
        }),
    });

  connectors.singleton("api_key").create({
    auth: true,
    summary: "Store a connector API key",
    paramSchema: connectorParamsSchema,
    bodySchema: recipeConnectorApiKeyRequestSchema,
    handler: ({ params, body, serviceContext, user }) =>
      storeRecipeConnectorApiKey({
        context: serviceContext,
        userId: user.id,
        provider: params.connector_id,
        apiKey: body.apiKey,
      }),
  });

  connectors
    .sub("accounts", "account_id")
    .list({
      auth: true,
      summary: "List connected accounts",
      paramSchema: connectorParamsSchema,
      handler: async ({ params, serviceContext, user }) =>
        listPageOf(
          (
            await listRecipeConnectorAccounts({
              context: serviceContext,
              userId: user.id,
              providerId: params.connector_id,
            })
          ).accounts,
          (account) => account.id,
        ),
    })
    .update({
      auth: true,
      summary: "Label or select a connected account",
      paramSchema: accountParamsSchema,
      bodySchema: recipeConnectorAccountUpdateRequestSchema.omit({ accountId: true }),
      responses: { 200: { description: "The account", schema: recipeConnectorAccountSchema } },
      handler: ({ params, body, serviceContext, user }) =>
        updateRecipeConnectorAccount({
          context: serviceContext,
          userId: user.id,
          providerId: params.connector_id,
          input: { ...body, accountId: params.account_id },
        }),
    });
});

export default app;
