import { type Context, Hono, type Next } from "hono";

import { allowRestrictedPaths } from "~/middleware/auth";
import { createRouteLogger } from "~/middleware/loggerMiddleware";

import { registerArtifactBindingRoutes } from "./artifact-bindings";
import { registerConversationOrganisationRoutes } from "./chat-organisation";
import { registerCompletionCreationRoutes } from "./completion-creation";
import { registerConversationHistoryRoutes } from "./conversation-history";
import { registerConversationGoalAndDelegationRoutes } from "./goals-and-delegations";
import { registerQueuedMessageRoutes } from "./queued-messages";
import { registerConversationRunRoutes } from "./run-lifecycle";
import { registerConversationSafetyAndSharingRoutes } from "./safety-and-sharing";
import { registerStoredConversationRoutes } from "./stored-conversations";

const app = new Hono();
const routeLogger = createRouteLogger("chat");

app.use("/*", async (context: Context, next: Next) => {
  routeLogger.info(`Processing chat route: ${context.req.path}`);

  await allowRestrictedPaths(context, next);
});

registerCompletionCreationRoutes(app);
registerStoredConversationRoutes(app);
registerConversationRunRoutes(app);
registerQueuedMessageRoutes(app);
registerArtifactBindingRoutes(app);
registerConversationHistoryRoutes(app);
registerConversationGoalAndDelegationRoutes(app);
registerConversationSafetyAndSharingRoutes(app);
registerConversationOrganisationRoutes(app);

export default app;
