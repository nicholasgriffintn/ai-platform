import { anonymousCreditActor, userCreditActor } from "@ngriffin_uk/polychat-ai-billing";
import {
  recordOffPlatformUsageRequestSchema,
  usageBalanceResponseSchema,
  usageEventsQuerySchema,
  usageEventsResponseSchema,
  usageSummaryQuerySchema,
  usageSummaryResponseSchema,
  workspaceUsageSummaryResponseSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";
import z from "zod/v4";

import { defineResource, defineSingleton } from "~/infrastructure/http/resource";
import {
  getUsageBalance,
  getUsageSummary,
  listUsageEvents,
  recordOffPlatformUsage,
} from "~/modules/usage/application/reports";
import { getWorkspaceUsageSummary } from "~/modules/usage/application/workspace-reports";

const app = new Hono();

defineSingleton(app, { path: "/balance", tags: ["usage"] }, (balance) => {
  balance.read({
    auth: "user-or-anonymous",
    summary: "Get the current credit balance",
    description: "Included, used, reserved and overage credits for the period.",
    querySchema: usageSummaryQuerySchema,
    responses: { 200: { description: "Credit balance", schema: usageBalanceResponseSchema } },
    handler: ({ query, serviceContext, user, anonymousUser }) =>
      getUsageBalance(
        serviceContext,
        user?.id ? userCreditActor(user.id) : anonymousCreditActor(anonymousUser?.id),
        query.period,
      ),
  });
});

defineSingleton(app, { path: "/summary", tags: ["usage"] }, (summary) => {
  summary.read({
    auth: true,
    summary: "Summarise usage for a period",
    description:
      "Spend for a billing period grouped by source and vendor. Pass workspace_id for a workspace's spend, also grouped by project; owners and administrators only.",
    querySchema: usageSummaryQuerySchema.extend({ workspace_id: z.string().min(1).optional() }),
    responses: {
      200: {
        description: "Usage summary",
        schema: z.union([workspaceUsageSummaryResponseSchema, usageSummaryResponseSchema]),
      },
    },
    handler: ({ query, serviceContext, user }) =>
      query.workspace_id
        ? getWorkspaceUsageSummary(serviceContext, query.workspace_id, query)
        : getUsageSummary(serviceContext, user.id, query),
  });
});

defineResource(app, { path: "/events", idParam: "event_id", tags: ["usage"] }, (events) => {
  events
    .list({
      auth: true,
      summary: "List usage ledger events",
      querySchema: usageEventsQuerySchema,
      responses: { 200: { description: "Usage events", schema: usageEventsResponseSchema } },
      handler: ({ query, serviceContext, user }) => listUsageEvents(serviceContext, user.id, query),
    })
    .create({
      auth: true,
      summary: "Record an off-platform model run",
      description:
        "Records a zero-cost ledger event for a model that ran outside the hosted service.",
      bodySchema: recordOffPlatformUsageRequestSchema,
      handler: ({ body, serviceContext, user }) =>
        recordOffPlatformUsage(serviceContext, user.id, body),
    });
});

export default app;
