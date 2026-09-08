import { expect, provisionPersonaSession, test } from "../fixtures/polychat-test";

test("shows model sources once for a new account and remembers the choice", async ({
  page,
}, testInfo) => {
  const seed = `${testInfo.testId}:fresh-model-sources`;
  const session = await provisionPersonaSession("free", seed, undefined, []);

  await page.context().addCookies([
    {
      name: "session",
      value: session.sessionToken,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
      secure: false,
    },
  ]);

  await page.goto("/chat", { waitUntil: "domcontentloaded" });

  const dialog = page.getByRole("dialog", { name: "How models work here" });

  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Polychat: Ready")).toBeVisible();
  await expect(dialog.getByLabel("Your provider keys: Not configured")).toBeVisible();
  await expect(dialog.getByLabel("This browser: Available")).toBeVisible();
  await expect(dialog.getByLabel("Your machines: Not connected")).toBeVisible();

  await dialog.getByRole("button").last().click();
  await expect(dialog).toBeHidden();

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("dialog", { name: "How models work here" })).toHaveCount(0);
});
