import {
  oidcCallbackQuerySchema,
  oidcConnectionParamsSchema,
  oidcLoginQuerySchema,
  linkedOidcIdentitiesResponseSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";

import { getServiceContext } from "~/infrastructure/context/serviceContext";
import { addRoute } from "~/infrastructure/http/routeBuilder";
import {
  startEnterpriseSignIn,
  completeEnterpriseSignIn,
} from "~/modules/auth/application/enterprise/flow";
import { listLinkedEnterpriseIdentities } from "~/modules/auth/application/enterprise/linked-identities";

const app = new Hono();

addRoute(app, "get", "/connections", {
  auth: true,
  tags: ["auth", "identity"],
  summary: "List linked enterprise identities",
  responses: {
    200: { description: "Linked identities", schema: linkedOidcIdentitiesResponseSchema },
  },
  handler: ({ serviceContext }) => listLinkedEnterpriseIdentities(serviceContext),
});

app.get("/:connectionId", async (c) => {
  const { connectionId } = oidcConnectionParamsSchema.parse(c.req.param());
  const options = oidcLoginQuerySchema.parse(c.req.query());
  const result = await startEnterpriseSignIn(
    getServiceContext(c),
    connectionId,
    c.req.raw,
    options,
  );

  c.header("Set-Cookie", result.cookie);

  return c.redirect(result.url);
});

app.get("/:connectionId/callback", async (c) => {
  const { connectionId } = oidcConnectionParamsSchema.parse(c.req.param());
  const params = oidcCallbackQuerySchema.parse(c.req.query());
  const result = await completeEnterpriseSignIn(
    getServiceContext(c),
    connectionId,
    c.req.raw,
    params,
  );

  c.header("Set-Cookie", result.flowCookie, { append: true });
  if (result.sessionCookie) {
    c.header("Set-Cookie", result.sessionCookie, { append: true });
  }

  return c.redirect(result.url);
});

export default app;
