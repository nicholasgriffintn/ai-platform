import { Hono } from "hono";

import { requireAuth } from "~/middleware/auth";

import { defineTwentyQuestions, defineVerbatim } from "./games";
import { definePolis, isPublicPolisRead } from "./polis";
import { defineStrudel } from "./strudel";

const app = new Hono();

app.use("/*", async (context, next) =>
  isPublicPolisRead(context.req.method, context.req.path) ? next() : requireAuth(context, next),
);

defineStrudel(app);
defineTwentyQuestions(app);
defineVerbatim(app);
definePolis(app);

export default app;
