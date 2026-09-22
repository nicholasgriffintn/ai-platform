import { teammateResponseSchema } from "@ngriffin_uk/polychat-schemas";

import { expect, test } from "../fixtures/polychat-test";
import { requireSuccessfulResponse } from "../support/api-response";
import { E2E_API_BASE_URL, E2E_APP_BASE_URL } from "../support/environment";

const TEAMMATE_MODEL = "groq-openai-gpt-oss-120b";

test.describe("Hosted computer use", () => {
  test.use({ persona: "pro" });
  test.setTimeout(60_000);

  test("browses with a teammate and streams the desktop into the chat workbench", async ({
    homePage,
    page,
  }) => {
    const created = await page.request.post(`${E2E_API_BASE_URL}/teammates`, {
      headers: { origin: E2E_APP_BASE_URL },
      data: {
        name: "Browser journey teammate",
        kind: "colleague",
        model: TEAMMATE_MODEL,
        enabled_tools: ["use_computer", "web_search"],
      },
    });

    await requireSuccessfulResponse(created, "Create browsing teammate");
    const teammate = teammateResponseSchema.parse(await created.json());

    await homePage.navigate(`/chat?teammate=${teammate.id}`);
    await homePage.waitForPersonaReady("pro");
    await homePage.sendMessage(
      "Use the hosted computer to open https://example.com, then describe what you see. Only navigate; do not click or type.",
    );

    await expect(page.getByText("1440 × 900").first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("heading", { name: "Hosted computer" })).toBeVisible();

    await page.getByRole("button", { name: "Watch live" }).click();
    await expect(page.locator('iframe[title="Hosted computer live view"]')).toBeVisible();
    await expect(page.getByRole("button", { name: "Stop watching" })).toBeVisible();

    await homePage.sendMessage("Check the hosted computer for Example Domain");
    await expect(
      page.getByText("Checked condition: met — The page title is Example Domain").last(),
    ).toBeVisible();
  });
});
