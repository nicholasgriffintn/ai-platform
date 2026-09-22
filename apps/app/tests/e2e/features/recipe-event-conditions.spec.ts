import { createHmac } from "node:crypto";

import {
  assistantRecipeInstallResponseSchema,
  recipeComposioTriggerSchema,
  recipeConnectorAccountsResponseSchema,
  recipeConnectorStartResponseSchema,
} from "@ngriffin_uk/polychat-schemas";

import { expect, test } from "../fixtures/polychat-test";
import { requireSuccessfulResponse } from "../support/api-response";
import { E2E_API_BASE_URL, E2E_APP_BASE_URL } from "../support/environment";

const WEBHOOK_SECRET = "e2e-composio-webhook-secret";
const TRIGGER_SLUG = "AIRTABLE_RECORD_CREATED";

test.describe("Recipe event conditions", () => {
  test.use({ persona: "pro" });

  test("skips unmatched events and queues a matching event only once", async ({
    page,
    polychatApi,
  }) => {
    const headers = { origin: E2E_APP_BASE_URL };
    const user = await polychatApi.currentUser();

    if (!user) {
      throw new Error("Recipe event test requires an authenticated user");
    }

    const started = await page.request.post(`${E2E_API_BASE_URL}/apps/connectors/airtable/start`, {
      headers,
      data: {},
    });

    await requireSuccessfulResponse(started, "Start Airtable connection");
    const authorization = recipeConnectorStartResponseSchema.parse(await started.json());
    const connectedAccountId = new URL(authorization.authorizationUrl).searchParams.get(
      "connected_account_id",
    );

    if (!connectedAccountId) {
      throw new Error("Airtable authorization omitted its account ID");
    }

    const verified = await page.request.get(
      `${E2E_API_BASE_URL}/apps/connectors/composio/verify?status=success&connected_account_id=${encodeURIComponent(connectedAccountId)}`,
      { maxRedirects: 0 },
    );

    expect(verified.status()).toBe(302);

    const accountsResponse = await page.request.get(
      `${E2E_API_BASE_URL}/apps/connectors/airtable/accounts`,
    );

    await requireSuccessfulResponse(accountsResponse, "Read Airtable account");
    const accounts = recipeConnectorAccountsResponseSchema.parse(await accountsResponse.json());
    const account = accounts.accounts.find((entry) => entry.providerId === "airtable");

    if (!account) {
      throw new Error("Airtable account was not connected");
    }

    const installResponse = await page.request.post(
      `${E2E_API_BASE_URL}/apps/recipes/project-delivery-control/install`,
      { headers, data: { channel: "web" } },
    );

    await requireSuccessfulResponse(installResponse, "Install delivery recipe");
    const installation = assistantRecipeInstallResponseSchema.parse(
      await installResponse.json(),
    ).installation;

    if (!installation) {
      throw new Error("Recipe installation was not persisted");
    }

    const triggerResponse = await page.request.post(
      `${E2E_API_BASE_URL}/apps/recipes/installations/${installation.id}/composio-triggers`,
      {
        headers,
        data: {
          providerId: "airtable",
          triggerSlug: TRIGGER_SLUG,
          connectedAccountId: account.id,
          configuration: {},
          condition: "Only run for high-priority records",
        },
      },
    );

    await requireSuccessfulResponse(triggerResponse, "Create conditioned trigger");
    const trigger = recipeComposioTriggerSchema.parse(await triggerResponse.json());

    expect(trigger.condition).toBe("Only run for high-priority records");

    const sendEvent = async (eventId: string, priority: string) => {
      const payload = JSON.stringify({
        id: eventId,
        type: "composio.trigger.message",
        metadata: {
          trigger_slug: TRIGGER_SLUG,
          trigger_id: trigger.externalTriggerId,
          connected_account_id: account.id,
          user_id: `polychat:e2e:user:${user.id}`,
        },
        data: { priority },
        timestamp: new Date().toISOString(),
      });
      const webhookId = crypto.randomUUID();
      const timestamp = String(Math.floor(Date.now() / 1000));
      const signature = createHmac("sha256", WEBHOOK_SECRET)
        .update(`${webhookId}.${timestamp}.${payload}`)
        .digest("base64");
      const response = await page.request.post(`${E2E_API_BASE_URL}/webhooks/composio`, {
        headers: {
          "webhook-id": webhookId,
          "webhook-timestamp": timestamp,
          "webhook-signature": `v1,${signature}`,
          "content-type": "application/json",
        },
        data: payload,
      });

      await requireSuccessfulResponse(response, "Deliver signed recipe event");

      return response.json();
    };

    const ignoredId = crypto.randomUUID();

    expect(await sendEvent(ignoredId, "low")).toMatchObject({ accepted: true, queued: false });
    expect(await sendEvent(ignoredId, "low")).toMatchObject({ accepted: true, queued: false });

    const queuedId = crypto.randomUUID();
    const queued = await sendEvent(queuedId, "high");

    expect(queued).toMatchObject({ accepted: true, queued: true, taskId: expect.any(String) });
    expect(await sendEvent(queuedId, "high")).toMatchObject({
      accepted: true,
      queued: true,
      taskId: queued.taskId,
    });
  });
});
