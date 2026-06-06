import { Hono } from "hono";

import { handleSmsAssistantWebhook } from "~/lib/messaging/sms";

const app = new Hono();

app.post("/:userId/:providerId", async (c) => handleSmsAssistantWebhook(c));

export default app;
