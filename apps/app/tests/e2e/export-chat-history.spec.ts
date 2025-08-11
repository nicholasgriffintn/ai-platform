import { expect, test } from "@playwright/test";

// Assumes authenticated session via test setup or a dev server that treats users as logged in locally
// Adjust selectors to match the Profile page layout

test("export chat history triggers a CSV download", async ({ page, context }) => {
  await page.goto("/");

  // Navigate to Profile (depending on app nav; adjust if needed)
  await page.getByRole("link", { name: /profile/i }).click({ timeout: 10000 }).catch(() => {});

  // Click Chat History tab
  await page.getByRole("tab", { name: /chat history/i }).click({ timeout: 10000 }).catch(() => {});

  // Start waiting for the download before clicking
  const [ download ] = await Promise.all([
    context.waitForEvent("download"),
    page.getByRole("button", { name: /export csv/i }).click(),
  ]);

  const suggested = download.suggestedFilename();
  expect(suggested).toMatch(/chat-history-.*\.csv$/);

  const path = await download.path();
  if (path) {
    const content = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of content as any) {
      chunks.push(Buffer.from(chunk));
    }
    const text = Buffer.concat(chunks).toString("utf8");
    expect(text.split(/\r?\n/)[0]).toContain("conversation_id");
  }
});