import { Hono } from "hono";

import { defineResource } from "~/infrastructure/http/resource";
import { allowRestrictedPaths } from "~/middleware/auth";
import { createRouteLogger } from "~/middleware/loggerMiddleware";

import { defineConversationArtifactBindings } from "./artifact-bindings";
import { defineConversationBrief } from "./brief";
import { defineConversationGoalAndDelegations } from "./goals-and-delegations";
import { defineConversationHandles } from "./handles";
import { defineConversationItems } from "./items";
import { defineConversationOrganisation } from "./organisation";
import { defineConversationQueue } from "./queue";
import { defineConversationRecords } from "./records";
import { defineSavedItems } from "./saved-items";
import { defineConversationSharing } from "./sharing";

const app = new Hono();
const routeLogger = createRouteLogger("conversations");

app.use("/*", async (context, next) => {
  routeLogger.info(`Processing conversations route: ${context.req.path}`);

  await allowRestrictedPaths(context, next);
});

defineResource(app, { idParam: "conversation_id", tags: ["conversations"] }, (conversations) => {
  defineConversationRecords(conversations);
  defineConversationItems(conversations);
  defineConversationSharing(conversations);
  defineConversationOrganisation(conversations);
  defineConversationQueue(conversations);
  defineConversationArtifactBindings(conversations);
  defineConversationGoalAndDelegations(conversations);
  defineSavedItems(conversations);
  defineConversationHandles(conversations);
  defineConversationBrief(conversations);
});

export default app;
