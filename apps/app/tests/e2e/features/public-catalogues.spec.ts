import { expect, test } from "../fixtures/polychat-test";
import { PublicCataloguePage } from "../page-objects/PublicCataloguePage";

test("opens the public capability catalogue and exposes plan requirements before sign-in", async ({
  page,
}) => {
  const cataloguePage = new PublicCataloguePage(page);
  const catalogue = await cataloguePage.openCatalogue();
  const premiumTool = catalogue.tools.find((tool) => tool.type === "premium");
  const ownKeyTool = catalogue.tools.find((tool) => tool.type === "byok");

  expect(premiumTool).toBeDefined();
  expect(ownKeyTool).toBeDefined();
  await expect(
    page.getByText(`${catalogue.experiences.length} apps,`, { exact: false }),
  ).toBeVisible();
  for (const section of ["Apps", "Teammates", "Automations", "Model tools", "Function tools"]) {
    await cataloguePage.openSection(section);
    await expect(cataloguePage.section(section).getByRole("heading")).toBeInViewport();
  }

  await cataloguePage.openSection("Function tools");
  if (!premiumTool || !ownKeyTool) {
    throw new Error("The catalogue must contain premium and own-key tools");
  }

  await expect(cataloguePage.card("Function tools", premiumTool.name)).toContainText("Pro");
  await expect(cataloguePage.card("Function tools", ownKeyTool.name)).toContainText("Your keys");
  await cataloguePage.openSection("Curated by you");
  await expect(
    cataloguePage.section("Teammates, skills and installed automations are yours"),
  ).toBeInViewport();
  await cataloguePage.startCurating();
  await expect(page.getByRole("button", { name: /Sign in with GitHub/i })).toBeVisible();
});

test("hands a catalogue ask to the composer without signing in", async ({ homePage, page }) => {
  const cataloguePage = new PublicCataloguePage(page);

  await cataloguePage.openCatalogue();

  const hireLink = cataloguePage
    .section("Teammates")
    .getByRole("link", { name: /^Hire a / })
    .first();
  const label = (await hireLink.textContent())?.trim() ?? "";

  await hireLink.click();
  await expect(homePage.chatInput).toHaveValue(new RegExp(label.replace("Hire a ", ""), "i"));
  await expect(page).toHaveURL(/^[^?]*\/?$/);
});

test.describe("Signed-in public catalogue", () => {
  test.use({ persona: "free" });

  test("opens the personal capability library from the public curation section", async ({
    page,
  }) => {
    const cataloguePage = new PublicCataloguePage(page);

    await cataloguePage.openCatalogue();
    await cataloguePage.openSection("Curated by you");
    await cataloguePage.openPersonalLibrary();
    await expect(page).toHaveURL(/\/chat\/teammates$/);
    await expect(page.getByRole("heading", { name: "Teammates", level: 1 })).toBeVisible();
  });
});
