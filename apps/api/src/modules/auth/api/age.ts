import {
  ageConfirmationSchema,
  ageGateResponseSchema,
  errorResponseSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";

import { addRoute } from "~/infrastructure/http/routeBuilder";
import { recordAgeConfirmation, resolveAgeGateStatus } from "~/modules/auth/application/ageGate";

const app = new Hono();

addRoute(app, "get", "/", {
  tags: ["auth"],
  summary: "Get the age check status for the current user",
  auth: "user-or-anonymous",
  cache: "no-store",
  responses: {
    200: {
      description: "The current age check status",
      schema: ageGateResponseSchema,
    },
  },
  handler: async ({ serviceContext, user, anonymousUser }) => ({
    status: resolveAgeGateStatus(serviceContext.env, { user, anonymousUser }),
  }),
});

addRoute(app, "post", "/", {
  tags: ["auth"],
  summary: "Confirm the current user's date of birth",
  description:
    "Records whether the user meets the minimum age. The date of birth itself is not stored, and the first answer is final.",
  auth: "user-or-anonymous",
  bodySchema: ageConfirmationSchema,
  responses: {
    200: {
      description: "The age check status after confirmation",
      schema: ageGateResponseSchema,
    },
    400: {
      description: "The date of birth is not a real date",
      schema: errorResponseSchema,
    },
  },
  handler: async ({ serviceContext, user, anonymousUser, body }) => ({
    status: await recordAgeConfirmation({
      env: serviceContext.env,
      repositories: serviceContext.repositories,
      principal: { user, anonymousUser },
      birthDate: body.birth_date,
    }),
  }),
});

export default app;
