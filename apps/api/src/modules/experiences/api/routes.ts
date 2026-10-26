import { Hono } from "hono";

import { requireAuth } from "~/middleware/auth";

import { defineTwentyQuestions, defineVerbatim } from "./games";
import { defineStrudel } from "./strudel";

const app = new Hono();

app.use("/*", requireAuth);

defineStrudel(app);
defineTwentyQuestions(app);
defineVerbatim(app);

export default app;
