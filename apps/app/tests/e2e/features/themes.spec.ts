import { expect, test } from "../fixtures/polychat-test";
import { ThemePage } from "../page-objects/ThemePage";

test.describe("Device theme preferences", () => {
  test.use({ persona: "pro" });

  test("remembers the day and night pair across appearance changes, reloads and explicit themes", async ({
    page,
    profilePage,
  }) => {
    const themes = new ThemePage(page);

    await themes.setSystemAppearance("light");
    await profilePage.openTab("customisation", "Customise Chat");
    await themes.select("System");
    await themes.option("System").press("Tab");
    await expect(themes.day).toBeFocused();
    await themes.day.press("Tab");
    await expect(themes.night).toBeFocused();
    await expect(themes.day.locator("option")).toHaveText(["Light", "Paper", "Dawn"]);
    await expect(themes.night.locator("option")).toHaveText(["Dark", "Blue", "Fern", "Plum"]);
    await themes.selectPair("paper", "fern");
    await expect(themes.option("System")).toBeChecked();
    await expect(themes.root).toHaveAttribute("data-polychat-theme", "paper");
    await profilePage.reload();
    await expect(themes.root).toHaveAttribute("data-polychat-theme", "paper");
    await themes.setSystemAppearance("dark");
    await expect(themes.root).toHaveAttribute("data-polychat-theme", "fern");
    await profilePage.reload();
    await expect(themes.root).toHaveAttribute("data-polychat-theme", "fern");
    await themes.select("Plum");
    await themes.setSystemAppearance("light");
    await expect(themes.root).toHaveAttribute("data-polychat-theme", "plum");
    await themes.select("System");
    await expect(themes.root).toHaveAttribute("data-polychat-theme", "paper");
    await expect(themes.day).toHaveValue("paper");
    await expect(themes.night).toHaveValue("fern");
  });

  test("rejects a stored pair with reversed appearances", async ({ page, profilePage }) => {
    const themes = new ThemePage(page);

    await profilePage.openTab("customisation", "Customise Chat");
    await themes.select("System");
    await themes.setStoredPair("fern:paper");
    await themes.setSystemAppearance("light");
    await profilePage.reload();
    await expect(themes.day).toHaveValue("light");
    await expect(themes.night).toHaveValue("dark");
    await expect(themes.root).toHaveAttribute("data-polychat-theme", "light");
    await themes.setSystemAppearance("dark");
    await expect(themes.root).toHaveAttribute("data-polychat-theme", "dark");
  });
});

test("keeps sidebar settings open after a theme change and remembers it after reload", async ({
  appPage,
  homePage,
  page,
}) => {
  await homePage.navigate("/chat");
  await appPage.openSettings("Guest");
  await appPage.openThemeOptions();
  await expect(page.getByRole("menuitemradio")).toHaveText([
    "System",
    "Light",
    "Paper",
    "Dawn",
    "Dark",
    "Blue",
    "Fern",
    "Plum",
  ]);
  await expect(page.getByRole("menuitemradio", { name: "System", exact: true })).toBeChecked();
  await page.getByRole("menuitemradio", { name: "Fern", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-polychat-theme", "fern");
  await expect(page.getByRole("button", { name: "Keyboard shortcuts" })).toBeVisible();
  await homePage.reload();
  await expect(page.locator("html")).toHaveAttribute("data-polychat-theme", "fern");
  await appPage.openSettings("Guest");
  await appPage.selectTheme("Light");
  await expect(page.locator("html")).toHaveAttribute("data-polychat-theme", "light");
});
