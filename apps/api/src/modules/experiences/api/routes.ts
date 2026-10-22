import { Hono } from "hono";

import { requireAuth } from "~/middleware/auth";

import { defineArticles } from "./articles";
import { defineDrawings } from "./drawings";
import { defineForecasts } from "./forecasts";
import { defineTwentyQuestions, defineVerbatim } from "./games";
import { defineExperienceModels } from "./models";
import { defineNotes } from "./notes";
import { defineRecordings } from "./recordings";
import { defineStrudel } from "./strudel";

const app = new Hono();

app.use("/*", requireAuth);

defineNotes(app);
defineDrawings(app);
defineStrudel(app);
defineArticles(app);
defineRecordings(app);
defineTwentyQuestions(app);
defineVerbatim(app);
defineForecasts(app);
defineExperienceModels(app);

export default app;
