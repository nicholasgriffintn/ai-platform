import { Hono } from "hono";

import { handleStripeWebhook } from "~/modules/subscription/application";
import type { IEnv } from "~/types";

const app = new Hono<{ Bindings: IEnv }>();

app.post("/", async (c) => {
  const response = await handleStripeWebhook(
    c.env,
    c.req.header("stripe-signature"),
    await c.req.text(),
  );

  return c.json(response);
});

export default app;
