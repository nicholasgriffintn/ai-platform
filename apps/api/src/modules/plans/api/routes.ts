import {
  apiResponseSchema,
  listPageOf,
  planCreditsUpdateSchema,
  planParamsSchema,
  planResponseSchema,
  plansResponseSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";

import { defineResource } from "~/infrastructure/http/resource";
import { requireStrictAdmin } from "~/middleware/adminMiddleware";
import { getPlanDetails, listPlans, updatePlanCredits } from "~/modules/plans/application/plans";

const app = new Hono();

defineResource(app, { idParam: "plan_id", tags: ["plans"] }, (plans) => {
  plans
    .list({
      auth: false,
      summary: "List subscription plans",
      responses: { 200: { description: "Plans", schema: plansResponseSchema } },
      handler: async ({ serviceContext }) =>
        listPageOf(await listPlans(serviceContext.env), (plan) => plan.id),
    })
    .read({
      auth: false,
      summary: "Get a subscription plan",
      paramSchema: planParamsSchema,
      responses: { 200: { description: "The plan", schema: planResponseSchema } },
      handler: ({ params, serviceContext }) => getPlanDetails(serviceContext.env, params.plan_id),
    });

  plans.singleton("credits").update({
    auth: true,
    tags: ["plans", "admin"],
    summary: "Set plan credits and Stripe metering configuration",
    description:
      "Set included credits, grace credits, the Stripe meter event name and the overage price for a plan. Admins only.",
    middleware: [requireStrictAdmin],
    paramSchema: planParamsSchema,
    bodySchema: planCreditsUpdateSchema,
    responses: { 200: { description: "Plan updated", schema: apiResponseSchema } },
    handler: ({ body, params, serviceContext }) =>
      updatePlanCredits(serviceContext.env, params.plan_id, body),
  });
});

export default app;
