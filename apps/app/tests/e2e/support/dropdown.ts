import { expect, type Locator } from "@playwright/test";

/**
 * Dropdowns render as a menu button rather than a native select, so choosing an
 * option means opening the menu and clicking the item by its visible label.
 */
export async function chooseDropdownOption(trigger: Locator, optionLabel: string | RegExp) {
  await trigger.click();
  await trigger
    .page()
    .getByRole("menuitem", { name: optionLabel, exact: typeof optionLabel === "string" })
    .click();
}

export async function expectDropdownValue(trigger: Locator, optionLabel: string | RegExp) {
  await expect(trigger).toContainText(optionLabel);
}
