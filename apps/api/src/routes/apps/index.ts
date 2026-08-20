import { Hono } from "hono";

import { requireAuth } from "~/middleware/auth";
import { createRouteLogger } from "~/middleware/loggerMiddleware";

import articles from "./articles";
import canvas from "./canvas";
import connectors from "./connectors";
import drawing from "./drawing";
import embeddings from "./embeddings";
import notes from "./notes";
import podcasts from "./podcasts";
import recipes from "./recipes";
import replicate from "./replicate";
import retrieval from "./retrieval";
import sandbox from "./sandbox";
import strudel from "./strudel";

const app = new Hono();

const routeLogger = createRouteLogger("apps");

app.use("/*", (c, next) => {
  routeLogger.info(`Processing apps route: ${c.req.path}`);

  return next();
});

app.use("/*", requireAuth);

app.route("/embeddings", embeddings);

app.route("/drawing", drawing);

app.route("/podcasts", podcasts);

app.route("/articles", articles);

app.route("/notes", notes);

app.route("/retrieval", retrieval);

app.route("/replicate", replicate);

app.route("/canvas", canvas);

app.route("/strudel", strudel);

app.route("/sandbox", sandbox);

app.route("/recipes", recipes);

app.route("/connectors", connectors);

export default app;
