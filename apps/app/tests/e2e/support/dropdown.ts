import { expect, type Locator } from "@playwright/test";

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
