import { Hono } from "hono";

import { handleChannelWebhook } from "~/modules/webhooks/application/channels";

const app = new Hono();

app.post("/:channel", async (c) => handleChannelWebhook(c));

export default app;
