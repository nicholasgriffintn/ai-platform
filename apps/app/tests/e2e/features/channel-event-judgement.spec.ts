import { channelBindingSchema } from "@ngriffin_uk/polychat-schemas";

import { expect, test } from "../fixtures/polychat-test";
import { requireSuccessfulResponse } from "../support/api-response";
import { E2E_API_BASE_URL, E2E_APP_BASE_URL } from "../support/environment";

test.describe("Channel event judgement", () => {
  test.use({ persona: "pro" });

  test("flags a Telegram message for attention without sending an automatic reply", async ({
    homePage,
    page,
  }) => {
    const externalId = String(Date.now());
    const created = await page.request.post(`${E2E_API_BASE_URL}/channels/bindings`, {
      headers: { origin: E2E_APP_BASE_URL },
      data: { channel: "telegram", externalId, interactionMode: "automated" },
    });

    await requireSuccessfulResponse(created, "Bind Telegram channel");
    const binding = channelBindingSchema.parse(await created.json());

    expect(binding.interactionMode).toBe("automated");

    const webhook = await page.request.post(`${E2E_API_BASE_URL}/webhooks/channels/telegram`, {
      headers: { "x-telegram-bot-api-secret-token": "e2e-telegram-webhook-secret" },
      data: {
        update_id: Date.now(),
        message: {
          message_id: Date.now(),
          chat: { id: Number(externalId) },
          from: { id: Number(externalId), is_bot: false },
          text: "Flag this for owner review; no reply needed.",
        },
      },
    });

    await requireSuccessfulResponse(webhook, "Deliver Telegram event");
    expect(await webhook.json()).toMatchObject({ success: true, taskId: expect.any(String) });

    await expect
      .poll(
        async () => {
          const response = await page.request.get(`${E2E_API_BASE_URL}/chat/completions`);

          return (
            response.ok() && JSON.stringify(await response.json()).includes("Telegram activity")
          );
        },
        { timeout: 30_000 },
      )
      .toBe(true);

    await homePage.navigate("/chat");
    await page.getByRole("button", { name: "Telegram activity" }).click();
    await expect(page.getByText("Telegram message needs attention")).toBeVisible();
    await expect(page.getByText("Flag this for owner review; no reply needed.")).toBeVisible();
  });
});
