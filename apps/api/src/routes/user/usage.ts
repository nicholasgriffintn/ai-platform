import {
  errorResponseSchema,
  usageBalanceResponseSchema,
  usageEventsQuerySchema,
  usageEventsResponseSchema,
  usageSummaryQuerySchema,
  usageSummaryResponseSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";

import { addRoute } from "~/lib/http/routeBuilder";
import { anonymousCreditActor, userCreditActor } from "~/lib/usage/creditActor";
import { getUsageBalance, getUsageSummary, listUsageEvents } from "~/services/user/usage";

const app = new Hono();

addRoute(app, "get", "/balance", {
  tags: ["user"],
  auth: "user-or-anonymous",
  summary: "Get the current credit balance",
  description: "Returns included, used, reserved and overage credits for the current period",
  querySchema: usageSummaryQuerySchema,
  responses: {
    200: { description: "Credit balance", schema: usageBalanceResponseSchema },
    401: { description: "Authentication required", schema: errorResponseSchema },
  },
  handler: ({ query, serviceContext, user, anonymousUser }) =>
    getUsageBalance(
      serviceContext,
      user?.id ? userCreditActor(user.id) : anonymousCreditActor(anonymousUser?.id as string),
      query.period,
    ),
});

addRoute(app, "get", "/summary", {
  tags: ["user"],
  auth: true,
  summary: "Summarise usage for a period",
  description: "Returns spend for a billing period grouped by source and vendor",
  querySchema: usageSummaryQuerySchema,
  responses: {
    200: { description: "Usage summary", schema: usageSummaryResponseSchema },
    401: { description: "Authentication required", schema: errorResponseSchema },
  },
  handler: ({ query, serviceContext, user }) => getUsageSummary(serviceContext, user.id, query),
});

addRoute(app, "get", "/events", {
  tags: ["user"],
  auth: true,
  summary: "List usage ledger events",
  description: "Returns a cursor-paginated page of the account's usage ledger",
  querySchema: usageEventsQuerySchema,
  responses: {
    200: { description: "Usage events", schema: usageEventsResponseSchema },
    401: { description: "Authentication required", schema: errorResponseSchema },
  },
  handler: ({ query, serviceContext, user }) => listUsageEvents(serviceContext, user.id, query),
});

export default app;
