import { BasePage } from "./BasePage";

export class DiscoverPage extends BasePage {
  get homeTour() {
    return this.page.getByRole("complementary", { name: "Discover Polychat" });
  }

  get sectionLinks() {
    return this.page.getByRole("navigation", { name: "Discover sections" }).getByRole("link");
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
}
