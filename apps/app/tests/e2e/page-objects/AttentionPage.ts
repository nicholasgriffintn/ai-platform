import { chooseDropdownOption } from "../support/dropdown";
import { BasePage } from "./BasePage";

type AttentionFacet = "State" | "Workspace" | "Project" | "Owner" | "Type";

export class AttentionPage extends BasePage {
  async open(search: string = "") {
    await this.navigate(`/work/attention${search}`);
    await this.page.getByRole("heading", { name: "Attention", exact: true }).waitFor();
  }

  get list() {
    return this.page.getByRole("list", { name: "Attention items" });
  }

  get rows() {
    return this.list.getByRole("listitem");
  }

  get pagination() {
    return this.page.getByRole("navigation", { name: "Attention pages" });
  }

  item(title: string) {
    return this.list.getByRole("link", { name: title, exact: true });
  }

  emptyResult(message: "Nothing needs attention" | "No work matches these filters") {
    return this.page.getByRole("heading", { name: message, exact: true });
  }

  titles() {
    return this.list
      .getByRole("link")
      .evaluateAll((links) => links.map((link) => link.getAttribute("aria-label") ?? ""));
  }

  private facet(label: AttentionFacet) {
    return this.page.getByLabel(label, { exact: true });
  }

  async filterBy(label: AttentionFacet, optionLabel: string) {
    await chooseDropdownOption(this.facet(label), optionLabel);
  }

  async facetOptions(label: AttentionFacet) {
    await this.facet(label).click();
    const options = await this.page.getByRole("menuitem").allInnerTexts();

    await this.page.keyboard.press("Escape");

    return options;
  }

  async setDateRange(from: string, to: string) {
    await this.page.getByLabel("From", { exact: true }).fill(from);
    await this.page.getByLabel("To", { exact: true }).fill(to);
  }

  async clearFilters() {
    await this.page.getByRole("button", { name: "Clear filters", exact: true }).click();
  }

  async goToNextPage() {
    await this.pagination.getByRole("button", { name: "Next", exact: true }).click();
  }

  async goToPreviousPage() {
    await this.pagination.getByRole("button", { name: "Previous", exact: true }).click();
  }

  search() {
    return new URL(this.page.url()).search;
  }
}
