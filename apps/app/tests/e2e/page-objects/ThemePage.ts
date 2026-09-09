import type { Locator, Page } from "@playwright/test";

import { customPropertyColourChannels, renderedColourChannels } from "../support/colour";
import { chooseDropdownOption } from "../support/dropdown";
import { BasePage } from "./BasePage";

export class ThemePage extends BasePage {
  readonly root: Locator;
  readonly day: Locator;
  readonly night: Locator;

  constructor(page: Page) {
    super(page);
    this.root = page.locator("html");
    this.day = page.getByLabel("By day", { exact: true });
    this.night = page.getByLabel("By night", { exact: true });
  }

  option(name: string) {
    return this.page.getByRole("radio", { name: new RegExp(`^${name}\\b`) });
  }

  card(name: string) {
    return this.option(name).locator("..");
  }

  browserColour() {
    return this.page.locator('meta[name="theme-color"]');
  }

  async viewportHasOverflow() {
    return this.page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  }

  async selectedCardOutline(name: string) {
    return this.card(name).evaluate((element) => {
      const style = getComputedStyle(element);

      return { width: parseFloat(style.outlineWidth), style: style.outlineStyle };
    });
  }

  systemCard() {
    return this.option("System").locator("..");
  }

  async select(name: string) {
    await this.option(name).press("Space");
  }

  async selectPair(day: string, night: string) {
    await chooseDropdownOption(this.day, day);
    await chooseDropdownOption(this.night, night);
  }

  async setSystemAppearance(colorScheme: "light" | "dark") {
    await this.page.emulateMedia({ colorScheme });
  }

  async setStoredPair(pair: string) {
    await this.page.evaluate((value) => {
      localStorage.setItem("polychat-theme-pair", value);
    }, pair);
  }

  async systemPreviewThemes() {
    return this.systemCard()
      .locator("[data-polychat-theme]")
      .evaluateAll((elements) =>
        elements.map((element) => element.getAttribute("data-polychat-theme")),
      );
  }

  cardDescription(name: string, description: string) {
    return this.card(name).getByText(description, { exact: true });
  }

  cardComposerMock(name: string) {
    return this.card(name).getByText("What’s on your mind?", { exact: true });
  }

  cardRoleChips(name: string) {
    return this.card(name).locator("span.h-4.w-4.rounded");
  }

  themeNameFontFamily(name: string) {
    return this.card(name)
      .getByText(name, { exact: true })
      .first()
      .evaluate((element) => getComputedStyle(element).fontFamily);
  }

  appearanceCaptionFontFamily(name: string) {
    return this.card(name)
      .locator(".polychat-eyebrow")
      .first()
      .evaluate((element) => getComputedStyle(element).fontFamily);
  }

  highlightChannels(locator: Locator) {
    return customPropertyColourChannels(locator, "--polychat-highlight");
  }

  selectionTextChannels(locator: Locator) {
    return customPropertyColourChannels(locator, "--polychat-text");
  }

  canvasChannels(locator: Locator) {
    return customPropertyColourChannels(locator, "--polychat-canvas");
  }

  primaryActionChannels(locator: Locator) {
    return customPropertyColourChannels(locator, "--polychat-human-action");
  }

  async themeCardColours(name: string) {
    const card = this.option(name).locator("..");
    const heading = card.getByText(name, { exact: true }).first();
    const previewText = card.getByText("What’s on your mind?", { exact: true });

    return {
      background: await renderedColourChannels(card, "backgroundColor"),
      heading: await renderedColourChannels(heading, "color"),
      previewText: await renderedColourChannels(previewText, "color"),
    };
  }

  async recordThemeFramesAcrossNavigations() {
    await this.page.addInitScript(() => {
      const frames: string[] = [];
      let frameCount = 0;
      const record = () => {
        const theme = document.documentElement?.dataset.polychatTheme;

        if (theme) {
          frames.push(theme);
        }

        frameCount += 1;
        if (frameCount < 12 || document.readyState !== "complete") {
          requestAnimationFrame(record);
        }
      };

      Reflect.set(window, "__polychatThemeFrames", frames);
      requestAnimationFrame(record);
    });
  }

  async recordedThemeFrames() {
    const frames = await this.page.evaluate(() => Reflect.get(window, "__polychatThemeFrames"));

    if (!Array.isArray(frames) || frames.some((theme) => typeof theme !== "string")) {
      throw new Error("Theme frame recording was not initialised");
    }

    return frames.filter((theme): theme is string => typeof theme === "string");
  }
}
