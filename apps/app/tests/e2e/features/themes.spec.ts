import { expect, test } from "../fixtures/polychat-test";
import { ThemePage } from "../page-objects/ThemePage";
import { relativeLuminance } from "../support/colour";

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
    await expect(themes.systemCard()).toContainText("Paper · Fern");
    expect(await themes.systemPreviewThemes()).toEqual(["paper", "fern"]);
    await expect(themes.root).toHaveAttribute("data-polychat-theme", "paper");
    await themes.recordThemeFramesAcrossNavigations();
    await profilePage.reload();
    await expect(themes.root).toHaveAttribute("data-polychat-theme", "paper");
    const dayFrames = await themes.recordedThemeFrames();

    expect(dayFrames.length).toBeGreaterThan(0);
    expect(dayFrames.every((theme) => theme === "paper")).toBe(true);
    await themes.setSystemAppearance("dark");
    await expect(themes.root).toHaveAttribute("data-polychat-theme", "fern");
    await profilePage.reload();
    await expect(themes.root).toHaveAttribute("data-polychat-theme", "fern");
    const nightFrames = await themes.recordedThemeFrames();

    expect(nightFrames.length).toBeGreaterThan(0);
    expect(nightFrames.every((theme) => theme === "fern")).toBe(true);
    await themes.select("Plum");
    await themes.setSystemAppearance("light");
    await expect(themes.root).toHaveAttribute("data-polychat-theme", "plum");
    await themes.select("System");
    await expect(themes.root).toHaveAttribute("data-polychat-theme", "paper");
    await expect(themes.day).toHaveValue("paper");
    await expect(themes.night).toHaveValue("fern");
  });

  test("changes both System palettes from the keyboard without changing the selected theme", async ({
    page,
    profilePage,
  }) => {
    const themes = new ThemePage(page);

    await themes.setSystemAppearance("light");
    await profilePage.openTab("customisation", "Customise Chat");
    await themes.select("System");
    await themes.option("System").press("Tab");
    await expect(themes.day).toBeFocused();
    await themes.day.press("ArrowDown");
    await expect(themes.day).toHaveValue("paper");
    await expect(themes.option("System")).toBeChecked();
    await themes.day.press("Tab");
    await expect(themes.night).toBeFocused();
    await themes.night.press("ArrowDown");
    await expect(themes.night).toHaveValue("blue");
    await expect(themes.option("System")).toBeChecked();
    await expect(themes.systemCard()).toContainText("Paper · Blue");
    expect(await themes.systemPreviewThemes()).toEqual(["paper", "blue"]);
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

  test("keeps every theme card readable against the active app appearance", async ({
    page,
    profilePage,
  }) => {
    const themes = new ThemePage(page);

    await profilePage.openTab("customisation", "Customise Chat");
    await themes.select("Dark");
    const lightCards = await Promise.all(
      ["Light", "Paper", "Dawn"].map((name) => themes.themeCardColours(name)),
    );

    for (const colours of lightCards) {
      expect(relativeLuminance(colours.heading)).toBeLessThan(
        relativeLuminance(colours.background),
      );
      expect(relativeLuminance(colours.previewText)).toBeLessThan(
        relativeLuminance(colours.background),
      );
    }

    await themes.select("Light");
    const darkCards = await Promise.all(
      ["Dark", "Blue", "Fern", "Plum"].map((name) => themes.themeCardColours(name)),
    );

    for (const colours of darkCards) {
      expect(relativeLuminance(colours.heading)).toBeGreaterThan(
        relativeLuminance(colours.background),
      );
      expect(relativeLuminance(colours.previewText)).toBeGreaterThan(
        relativeLuminance(colours.background),
      );
    }
  });
});

test("keeps sidebar settings open after a theme change and remembers it after reload", async ({
  appPage,
  homePage,
  page,
}) => {
  await homePage.navigate("/chat");
  await appPage.openSettings("Guest");
  expect(await appPage.focusedInteractiveSettingsRows()).toBe(0);
  expect(await appPage.themeRowState()).toBe("closed");
  await appPage.closeSettings();
  await appPage.openSettingsWithKeyboard("Guest");
  await page.keyboard.press("Tab");
  await expect(appPage.firstSettingsRow("Guest")).toBeFocused();
  await appPage.closeSettings();
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
  await appPage.closeSettings();
  await page.setViewportSize({ width: 390, height: 844 });
  await appPage.toggleSidebar();
  await appPage.openSettings("Guest");
  await appPage.openThemeOptions();
  expect(await appPage.themeMenuFitsViewport()).toBe(true);
});

test("lets a guest choose a palette from the sidebar and keeps it", async ({ appPage, page }) => {
  await page.goto("/chat", { waitUntil: "domcontentloaded" });
  await appPage.openSettings("Guest");

  const settings = page.getByRole("dialog");

  await expect(settings.getByText("Theme", { exact: true })).toBeVisible();
  await appPage.selectTheme("Plum");
  await expect(page.locator("html")).toHaveAttribute("data-polychat-theme", "plum");

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("html")).toHaveAttribute("data-polychat-theme", "plum");
});

test("adopts a theme stored under the retired key exactly once", async ({ page }) => {
  await page.goto("/chat", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    window.localStorage.removeItem("polychat-theme");
    window.localStorage.setItem("theme", "dark");
  });
  await page.reload({ waitUntil: "domcontentloaded" });

  await expect(page.locator("html")).toHaveAttribute("data-polychat-theme", "dark");
  await expect
    .poll(() =>
      page.evaluate(() => ({
        current: window.localStorage.getItem("polychat-theme"),
        retired: window.localStorage.getItem("theme"),
      })),
    )
    .toEqual({ current: "dark", retired: null });
});
