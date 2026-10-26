import {
  workAttentionQuerySchema,
  workAttentionResponseSchema,
  workInboxResponseSchema,
  workTaskListResponseSchema,
  workTaskQuerySchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";

import { defineResource, defineSingleton } from "~/infrastructure/http/resource";
import { listWorkAttention } from "~/modules/attention/application";
import { getWorkInbox } from "~/modules/attention/application/inbox";
import { listMyWorkTasks } from "~/modules/project-tasks/application/listing";

const app = new Hono();

defineResource(app, { idParam: "attention_id", tags: ["attention"] }, (attention) => {
  attention.list({
    auth: true,
    summary: "List operational work across the caller's workspaces",
    description:
      "Derives filtered task interactions and sandbox run states through current membership. Facets and the filtered total come with each page.",
    querySchema: workAttentionQuerySchema,
    responses: { 200: { description: "Operational work", schema: workAttentionResponseSchema } },
    handler: ({ serviceContext, query }) => listWorkAttention(serviceContext, query),
  });
});

defineSingleton(app, { path: "/inbox", tags: ["attention"] }, (inbox) => {
  inbox.read({
    auth: true,
    summary: "List Work decisions waiting on the caller",
    description:
      "Hire proposals, budget warnings, standups to answer, escalations and setup plans.",
    responses: { 200: { description: "Inbox", schema: workInboxResponseSchema } },
    handler: ({ serviceContext }) => getWorkInbox(serviceContext),
  });
});

defineSingleton(app, { path: "/tasks", tags: ["attention"] }, (tasks) => {
  tasks.read({
    auth: true,
    summary: "List the caller's tasks across workspaces",
    description: "Tasks the caller owns, or is responsible for through a teammate.",
    querySchema: workTaskQuerySchema,
    responses: { 200: { description: "Tasks", schema: workTaskListResponseSchema } },
    handler: ({ serviceContext, query }) => listMyWorkTasks(serviceContext, query.include_done),
  });
});

export default app;
