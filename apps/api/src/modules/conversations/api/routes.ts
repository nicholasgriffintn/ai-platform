import { type Context, Hono, type Next } from "hono";

import { allowRestrictedPaths } from "~/middleware/auth";
import { createRouteLogger } from "~/middleware/loggerMiddleware";

import { registerArtifactBindingRoutes } from "./artifact-bindings";
import { registerConversationGoalAndDelegationRoutes } from "./goals-and-delegations";
import { registerConversationItemRoutes } from "./items";
import { registerConversationOrganisationRoutes } from "./organisation";
import { registerConversationQueueRoutes } from "./queue";
import { registerConversationRecordRoutes } from "./records";
import { registerConversationSharingRoutes } from "./sharing";

const app = new Hono();
const routeLogger = createRouteLogger("conversations");

app.use("/*", async (context: Context, next: Next) => {
  routeLogger.info(`Processing conversations route: ${context.req.path}`);

  await allowRestrictedPaths(context, next);
});

registerConversationSharingRoutes(app);
registerConversationItemRoutes(app);
registerConversationOrganisationRoutes(app);
registerConversationQueueRoutes(app);
registerArtifactBindingRoutes(app);
registerConversationGoalAndDelegationRoutes(app);
registerConversationRecordRoutes(app);

export default app;
