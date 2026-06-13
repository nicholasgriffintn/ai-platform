import { Hono } from "hono";

import { handleSmsAssistantWebhook } from "~/services/webhooks/sms";

const app = new Hono();

app.post("/:providerId/:providerSettingsId", async (c) => handleSmsAssistantWebhook(c));

export default app;
