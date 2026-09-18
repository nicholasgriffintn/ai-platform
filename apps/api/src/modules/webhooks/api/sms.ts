import { Hono } from "hono";

import { handleSmsAssistantWebhook } from "~/modules/webhooks/application/sms";

const app = new Hono();

app.post("/:providerId/:providerSettingsId", async (c) => handleSmsAssistantWebhook(c));

export default app;
