import { BasePage } from "./BasePage";

export class DiscoverPage extends BasePage {
  get homeTour() {
    return this.page.getByRole("complementary", { name: "Discover Polychat" });
  }

  get sectionLinks() {
    return this.page.getByRole("navigation", { name: "Discover sections" }).getByRole("link");
  }

  get primaryNavigation() {
    return this.page.getByRole("navigation", { name: "Primary" });
  }

  get petSprites() {
    return this.page.locator(".polychat-pet");
  }

  section(id: string) {
    return this.page.locator(`section[id="${id}"]`);
  }

  async openSection(name: string) {
    await this.page
      .getByRole("navigation", { name: "Discover sections" })
      .getByRole("link", { name, exact: true })
      .click();
  }

  async petSheetDimensions() {
    await this.petSprites.first().waitFor();

    return this.petSprites.evaluateAll((elements) =>
      Promise.all(
        elements.map(async (element) => {
          const source = /url\("?(.*?)"?\)/.exec(getComputedStyle(element).backgroundImage)?.[1];

          if (!source) {
            throw new Error(`No sprite sheet resolved for ${element.getAttribute("aria-label")}`);
          }

          const image = new Image();

          image.src = source;
          await image.decode();

          return {
            label: element.getAttribute("aria-label") ?? "",
            width: image.naturalWidth,
            height: image.naturalHeight,
          };
        }),
      ),
    );
  }
}
