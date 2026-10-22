import { Hono } from "hono";

import { requireAuth } from "~/middleware/auth";

import { defineArticles } from "./articles";
import { defineTwentyQuestions, defineVerbatim } from "./games";
import { defineNotes } from "./notes";
import { defineStrudel } from "./strudel";

const app = new Hono();

app.use("/*", requireAuth);

defineNotes(app);
defineStrudel(app);
defineArticles(app);
defineTwentyQuestions(app);
defineVerbatim(app);

export default app;
