import { anonymousCreditActor, userCreditActor } from "@ngriffin_uk/polychat-ai-billing";
import {
  recordOffPlatformUsageRequestSchema,
  usageBalanceResponseSchema,
  usageEventsQuerySchema,
  usageEventsResponseSchema,
  usageSummaryQuerySchema,
  usageSummaryResponseSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";

import { defineResource, defineSingleton } from "~/infrastructure/http/resource";
import {
  getUsageBalance,
  getUsageSummary,
  listUsageEvents,
  recordOffPlatformUsage,
} from "~/modules/usage/application/reports";

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
    description: "Spend for a billing period grouped by source and vendor.",
    querySchema: usageSummaryQuerySchema,
    responses: { 200: { description: "Usage summary", schema: usageSummaryResponseSchema } },
    handler: ({ query, serviceContext, user }) => getUsageSummary(serviceContext, user.id, query),
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
