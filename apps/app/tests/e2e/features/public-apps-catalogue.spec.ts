import { expect, test } from "../fixtures/polychat-test";

test("lists apps and teammates before sign-in and hands the ask to the composer", async ({
  homePage,
  page,
}) => {
  await homePage.navigate("/apps");
  await expect(
    page.getByRole("heading", { name: "Everything you can ask for on your first day" }),
  ).toBeVisible();
  await page.getByRole("list", { name: "Loading", exact: true }).first().waitFor({
    state: "hidden",
  });

  const appsSection = page.getByRole("region", { name: "Apps", exact: true });
  const recommended = page.getByRole("region", { name: "Recommended", exact: true });

  await expect(appsSection.getByRole("listitem").first()).toBeVisible();
  await expect(recommended.getByRole("listitem").first()).toBeVisible();

  const hireLink = recommended.getByRole("link", { name: /^Hire a / }).first();
  const label = (await hireLink.textContent())?.trim() ?? "";

  await hireLink.click();
  await expect(homePage.chatInput).toHaveValue(new RegExp(label.replace("Hire a ", ""), "i"));
  await expect(page).toHaveURL(/^[^?]*\/?$/);
});
