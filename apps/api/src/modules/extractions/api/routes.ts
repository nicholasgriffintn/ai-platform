import {
  errorResponseSchema,
  extractionRequestSchema,
  extractionResponseSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";

import { addRoute } from "~/infrastructure/http/routeBuilder";
import { extractValues } from "~/modules/extractions/application/extract";

const app = new Hono();

addRoute(app, "post", "/", {
  tags: ["extractions"],
  summary: "Extract typed values",
  description:
    "Reads a state of text, plus up to four images, and returns one typed value per named field from a System One extraction model: spans, numbers, dates, times, durations, lists, estimates and forecasts, each with a confidence or an 80% interval. Ask for every field in one call: fields are answered in parallel, so thirty cost about the same as three.",
  auth: true,
  bodySchema: extractionRequestSchema,
  responses: {
    200: { description: "Typed values with confidence", schema: extractionResponseSchema },
    400: { description: "Bad request or validation error", schema: errorResponseSchema },
  },
  handler: ({ body, serviceContext, user }) =>
    extractValues({ env: serviceContext.env, user, request: body }),
});

export default app;
