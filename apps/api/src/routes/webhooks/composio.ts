import { Hono } from "hono";

import { handleComposioWebhook } from "~/services/webhooks/composio";
import type { IEnv } from "~/types";

const app = new Hono<{ Bindings: IEnv }>();

app.post("/", (context) => handleComposioWebhook(context.req.raw, context.env));

export default app;
