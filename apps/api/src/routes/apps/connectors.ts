import {
  errorResponseSchema,
  connectorApprovalIdSchema,
  recipeConnectorApiKeyRequestSchema,
  recipeConnectorAccountSchema,
  recipeConnectorAccountsResponseSchema,
  recipeConnectorAccountUpdateRequestSchema,
  recipeConnectorProviderSchema,
  recipeConnectorsResponseSchema,
  recipeConnectorStartRequestSchema,
  recipeConnectorStartResponseSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";
import z from "zod/v4";

import { addRoute } from "~/lib/http/routeBuilder";
import {
  deleteRecipeConnectorConnection,
  listRecipeConnectors,
  startRecipeConnectorAuthorization,
  storeRecipeConnectorApiKey,
  verifyComposioConnectorAuthorization,
} from "~/services/apps/connectors";
import {
  listRecipeConnectorAccounts,
  updateRecipeConnectorAccount,
} from "~/services/apps/connectors/accounts";
import { resolveConnectorOperationApproval } from "~/services/apps/connectors/operation-approvals";

const app = new Hono();

app.use("/composio/verify", async (context, next) => {
  context.header("Cache-Control", "no-store");
  await next();
  context.header("Cache-Control", "no-store");
});

const providerParamSchema = z.object({ provider: recipeConnectorProviderSchema });
const approvalParamSchema = z.object({ approvalId: connectorApprovalIdSchema });
const approvalResolutionSchema = z.object({ resolution: z.enum(["approved", "rejected"]) });
const composioVerificationQuerySchema = z.union([
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

addRoute(app, "get", "/", {
  auth: true,
  tags: ["apps"],
  summary: "List recipe connectors",
  responses: {
    200: { description: "Recipe connectors", schema: recipeConnectorsResponseSchema },
  },
  handler: async ({ raw, serviceContext, user }) =>
    listRecipeConnectors({
      context: serviceContext,
      userId: user.id,
      requestUrl: raw.req.url,
    }),
});

addRoute(app, "post", "/:provider/start", {
  auth: true,
  tags: ["apps"],
  summary: "Start connector authorization",
  paramSchema: providerParamSchema,
  bodySchema: recipeConnectorStartRequestSchema,
  responses: {
    200: {
      description: "Connector authorization URL",
      schema: recipeConnectorStartResponseSchema,
    },
    400: { description: "Invalid connector", schema: errorResponseSchema },
  },
  handler: async ({ raw, params, body, serviceContext, user }) =>
    startRecipeConnectorAuthorization({
      context: serviceContext,
      userId: user.id,
      provider: params.provider,
      authConfigId: body.authConfigId,
      returnTo: body.returnTo,
      requestUrl: raw.req.url,
    }),
});

addRoute(app, "get", "/composio/verify", {
  auth: true,
  tags: ["apps"],
  summary: "Complete a Composio connector callback",
  querySchema: composioVerificationQuerySchema,
  responses: {
    302: { description: "Redirects to the app after verification" },
    400: { description: "Invalid or expired verification", schema: errorResponseSchema },
  },
  handler: async ({ raw, query, serviceContext, user }) => {
    const redirectUrl = await verifyComposioConnectorAuthorization({
      context: serviceContext,
      userId: user.id,
      ...("session_uri" in query
        ? { sessionUri: query.session_uri }
        : {
            status: query.status,
            connectedAccountId: query.connected_account_id,
          }),
    });

    raw.header("Cross-Origin-Opener-Policy", "unsafe-none");

    return raw.redirect(redirectUrl);
  },
});

addRoute(app, "put", "/approvals/:approvalId", {
  auth: true,
  tags: ["apps"],
  summary: "Resolve an exact connector operation approval",
  paramSchema: approvalParamSchema,
  bodySchema: approvalResolutionSchema,
  responses: {
    200: { description: "Connector approval resolved" },
    404: { description: "Connector approval missing or expired", schema: errorResponseSchema },
  },
  handler: async ({ params, body, serviceContext, user }) => ({
    approval: await resolveConnectorOperationApproval({
      context: serviceContext,
      userId: user.id,
      approvalId: params.approvalId,
      resolution: body.resolution,
    }),
  }),
});

addRoute(app, "post", "/:provider/api-key", {
  auth: true,
  tags: ["apps"],
  summary: "Store connector API key",
  paramSchema: providerParamSchema,
  bodySchema: recipeConnectorApiKeyRequestSchema,
  responses: {
    200: { description: "Connector API key stored" },
    400: { description: "Invalid connector", schema: errorResponseSchema },
  },
  handler: async ({ params, body, serviceContext, user }) =>
    storeRecipeConnectorApiKey({
      context: serviceContext,
      userId: user.id,
      provider: params.provider,
      apiKey: body.apiKey,
    }),
});

addRoute(app, "get", "/:provider/accounts", {
  auth: true,
  tags: ["apps"],
  summary: "List connector accounts",
  paramSchema: providerParamSchema,
  responses: {
    200: { description: "Connector accounts", schema: recipeConnectorAccountsResponseSchema },
    400: { description: "Invalid connector", schema: errorResponseSchema },
  },
  handler: ({ params, serviceContext, user }) =>
    listRecipeConnectorAccounts({
      context: serviceContext,
      userId: user.id,
      providerId: params.provider,
    }),
});

addRoute(app, "put", "/:provider/accounts", {
  auth: true,
  tags: ["apps"],
  summary: "Label or select a connector account",
  paramSchema: providerParamSchema,
  bodySchema: recipeConnectorAccountUpdateRequestSchema,
  responses: {
    200: { description: "Updated connector account", schema: recipeConnectorAccountSchema },
    404: { description: "Connector account not found", schema: errorResponseSchema },
  },
  handler: ({ params, body, serviceContext, user }) =>
    updateRecipeConnectorAccount({
      context: serviceContext,
      userId: user.id,
      providerId: params.provider,
      input: body,
    }),
});

addRoute(app, "delete", "/:provider", {
  auth: true,
  tags: ["apps"],
  summary: "Disconnect a recipe connector",
  paramSchema: providerParamSchema,
  responses: {
    200: { description: "Connector disconnected" },
    400: { description: "Invalid connector", schema: errorResponseSchema },
  },
  handler: async ({ params, serviceContext, user }) =>
    deleteRecipeConnectorConnection({
      context: serviceContext,
      userId: user.id,
      provider: params.provider,
    }),
});

export default app;
