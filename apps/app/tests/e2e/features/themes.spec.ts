import { THEMES } from "@ngriffin_uk/polychat-library-chat/theme";

import { expect, test } from "../fixtures/polychat-test";
import { ThemePage } from "../page-objects/ThemePage";
import { contrastRatio, relativeLuminance } from "../support/colour";

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
      await expect(themes.cardDescription(theme.label, theme.description)).toBeVisible();
      await expect(themes.cardComposerMock(theme.label)).toBeVisible();
      await expect(themes.cardRoleChips(theme.label)).toHaveCount(6);

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

  test("resolves one selection highlight token across the shell, the composer and settings inputs", async ({
    appPage,
    homePage,
    page,
    profilePage,
  }) => {
    const themes = new ThemePage(page);

    test.slow();
    await homePage.navigate("/chat");
    await homePage.selectModel("GPT OSS 120B");
    await homePage.sendMessageAndRequireCompletion("Paint something worth selecting");
    await homePage.waitForChatResponse(0);

    const userBubble = homePage.getLatestUserMessage();
    let lastThemeId = "";

    for (const theme of THEMES) {
      await appPage.openSettings("Pro");
      await appPage.openThemeOptions();
      await page.getByRole("menuitemradio", { name: theme.label, exact: true }).click();
      await appPage.closeSettings();
      await expect(themes.root).toHaveAttribute("data-polychat-theme", theme.id);
      lastThemeId = theme.id;

      const shellHighlight = await themes.highlightChannels(themes.root);
      const selectionText = await themes.selectionTextChannels(themes.root);

      expect(
        await themes.highlightChannels(homePage.chatInput),
        `Composer highlight in ${theme.id}`,
      ).toEqual(shellHighlight);
      expect(
        await themes.highlightChannels(userBubble),
        `User bubble highlight in ${theme.id}`,
      ).toEqual(shellHighlight);
      expect(
        await themes.primaryActionChannels(themes.root),
        `Highlight is not the primary colour in ${theme.id}`,
      ).not.toEqual(shellHighlight);
      expect(
        contrastRatio(shellHighlight, selectionText),
        `Selected text contrast in ${theme.id}`,
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(shellHighlight, await themes.canvasChannels(themes.root)),
        `Highlight against the canvas in ${theme.id}`,
      ).toBeGreaterThanOrEqual(1.5);
    }

    await profilePage.openTab("customisation", "Customise Chat");
    await expect(themes.root).toHaveAttribute("data-polychat-theme", lastThemeId);
    expect(
      await themes.highlightChannels(page.getByLabel("Nickname", { exact: true })),
      "Settings input highlight",
    ).toEqual(await themes.highlightChannels(themes.root));
  });

  test("carries a theme chosen from the sidebar into Customisation and keeps its house type", async ({
    appPage,
    homePage,
    page,
    profilePage,
  }) => {
    const themes = new ThemePage(page);

    await homePage.navigate("/chat");
    await appPage.openSettings("Pro");
    await appPage.selectTheme("Fern");
    await expect(themes.root).toHaveAttribute("data-polychat-theme", "fern");
    await appPage.closeSettings();
    await profilePage.openTab("customisation", "Customise Chat");
    await expect(themes.option("Fern")).toBeChecked();
    await expect(themes.root).toHaveAttribute("data-polychat-theme", "fern");
    expect(await themes.themeNameFontFamily("Fern")).toContain("Fraunces");
    expect(await themes.appearanceCaptionFontFamily("Fern")).toContain("IBM Plex Mono");
    await themes.select("Plum");
    await homePage.navigate("/chat");
    await appPage.openSettings("Pro");
    await appPage.openThemeOptions();
    await expect(page.getByRole("menuitemradio", { name: "Plum", exact: true })).toBeChecked();
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
    await themes.selectPair("Paper", "Fern");
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
