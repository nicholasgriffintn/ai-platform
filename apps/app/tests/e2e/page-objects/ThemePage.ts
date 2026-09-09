import type { Locator, Page } from "@playwright/test";

import { renderedColourChannels } from "../support/colour";
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
    await this.day.selectOption(day);
    await this.night.selectOption(night);
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
