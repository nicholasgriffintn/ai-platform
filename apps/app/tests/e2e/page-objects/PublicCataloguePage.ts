import { publicCapabilityCatalogueResponseSchema } from "@ngriffin_uk/polychat-schemas";

import { E2E_API_BASE_URL } from "../support/environment";
import { BasePage } from "./BasePage";

export class PublicCataloguePage extends BasePage {
  section(name: string) {
    return this.page.getByRole("region", { name, exact: true });
  }

  card(section: string, title: string) {
    return this.section(section)
      .getByRole("listitem")
      .filter({ has: this.page.getByText(title, { exact: true }) });
  }

  async openCapabilities() {
    const response = await this.page.request.get(`${E2E_API_BASE_URL}/capabilities/catalogue`);

    if (!response.ok()) {
      throw new Error(`Public capability catalogue failed with ${response.status()}`);
    }

    const catalogue = publicCapabilityCatalogueResponseSchema.parse(await response.json());

    await this.navigate("/capabilities");
    await this.page.getByRole("heading", { name: "Capabilities, not just chat" }).waitFor();
    await this.page
      .getByRole("list", { name: "Loading", exact: true })
      .first()
      .waitFor({ state: "hidden" });

    return catalogue;
  }

  async openSection(name: string) {
    await this.page
      .getByRole("navigation", { name: "Catalogue sections" })
      .getByRole("link", { name, exact: true })
      .click();
  }

  async startCurating() {
    await this.page.getByRole("button", { name: "Sign in to start curating" }).click();
  }

  async openPersonalLibrary() {
    await this.page.getByRole("link", { name: "Open your capabilities" }).click();
  }
}
