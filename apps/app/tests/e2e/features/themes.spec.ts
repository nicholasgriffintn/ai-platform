import { THEMES } from "@ngriffin_uk/polychat-library-chat";

import { expect, test } from "../fixtures/polychat-test";
import { ThemePage } from "../page-objects/ThemePage";
import { relativeLuminance } from "../support/colour";

test.describe("Device theme preferences", () => {
  test.use({ persona: "pro" });

  test("keeps every palette independently readable and persists each selection without a flash", async ({
    page,
    profilePage,
  }) => {
    const themes = new ThemePage(page);

    await page.setViewportSize({ width: 390, height: 844 });
    await profilePage.openTab("customisation", "Customise Chat");
    await themes.recordThemeFramesAcrossNavigations();

    for (const theme of THEMES) {
      await themes.select(theme.label);
      await expect(themes.option(theme.label)).toBeChecked();
      await expect(themes.root).toHaveAttribute("data-polychat-theme", theme.id);
      await expect(themes.browserColour()).toHaveAttribute("content", theme.themeColor);
      await expect(themes.card(theme.label)).toContainText(theme.themeColor);
      expect(await themes.selectedCardOutline(theme.label)).toMatchObject({ style: "solid" });
      expect((await themes.selectedCardOutline(theme.label)).width).toBeGreaterThanOrEqual(2);

      const colours = await themes.themeCardColours(theme.label);
      const background = relativeLuminance(colours.background);
      const heading = relativeLuminance(colours.heading);

      expect(
        (Math.max(background, heading) + 0.05) / (Math.min(background, heading) + 0.05),
      ).toBeGreaterThanOrEqual(4.5);
      expect(await themes.viewportHasOverflow()).toBe(false);
      await profilePage.reload();
      await expect(themes.root).toHaveAttribute("data-polychat-theme", theme.id);
      await expect(themes.option(theme.label)).toBeChecked();
      const frames = await themes.recordedThemeFrames();

      expect(frames.length).toBeGreaterThan(0);
      expect(frames, `Visible reload frames for ${theme.id}`).toEqual(frames.map(() => theme.id));
    }
  });

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
