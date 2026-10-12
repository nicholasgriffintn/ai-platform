import { Hono } from "hono";

import { handleRecipeWebhook } from "~/modules/webhooks/application/recipe-webhook";
import type { IEnv } from "~/types";

const app = new Hono<{ Bindings: IEnv }>();

app.post("/:token", (context) =>
  handleRecipeWebhook(context.req.raw, context.env, context.req.param("token")),
);

export default app;
