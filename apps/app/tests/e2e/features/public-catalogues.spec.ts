import { expect, test } from "../fixtures/polychat-test";
import { PublicCataloguePage } from "../page-objects/PublicCataloguePage";
import { trackCompletionRequests } from "../support/chat-run-requests";

const COMPOSER_PREFILL_MAX_LENGTH = 2000;

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
    await expect(cataloguePage.section(section).getByRole("heading").first()).toBeInViewport();
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
  await expect(homePage.chatInput).toHaveText(new RegExp(label.replace("Hire a ", ""), "i"));
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

test("describes every app, shows its connected services and types an ask exactly once", async ({
  homePage,
  page,
}) => {
  const cataloguePage = new PublicCataloguePage(page);
  const catalogue = await cataloguePage.openCatalogue();
  const [app] = catalogue.experiences;
  const connectedRecipe = catalogue.recipes.find((recipe) => recipe.integrations.length > 0);

  if (!app || !connectedRecipe) {
    throw new Error("The catalogue must contain an app and an automation with integrations");
  }

  await cataloguePage.openSection("Apps");
  await expect(cataloguePage.card("Apps", app.name)).toContainText(
    `${app.when} It works from ${app.uses.toLowerCase()} and leaves behind ${app.produces.toLowerCase()}`,
  );

  await cataloguePage.openSection("Automations");
  const services = cataloguePage
    .card("Automations", connectedRecipe.title)
    .getByRole("list", { name: "Connected services" });

  await expect(services).toBeVisible();
  await expect(services.getByRole("listitem")).toHaveCount(connectedRecipe.integrations.length);

  await cataloguePage.openSection("Apps");
  const completions = trackCompletionRequests(page);

  await cataloguePage
    .card("Apps", app.name)
    .getByRole("link", { name: `Open ${app.name}` })
    .click();

  await expect(homePage.chatInput).toHaveText(`${app.when} Use ${app.name}.`);
  await expect(page).toHaveURL(/^[^?]*\/?$/);

  await homePage.reload();
  await expect(homePage.chatInput).toHaveText("");
  expect(completions).toHaveLength(0);
});

test("keeps an oversized deep link typed rather than breaking the page", async ({
  homePage,
  page,
}) => {
  const prompt = "a".repeat(COMPOSER_PREFILL_MAX_LENGTH + 500);

  await homePage.navigate(`/?prompt=${prompt}`);

  await expect(homePage.chatInput).toHaveText("a".repeat(COMPOSER_PREFILL_MAX_LENGTH));
  await expect(page).toHaveURL(/^[^?]*\/?$/);
});

test("removes the duplicate capability catalogue and points discovery at Apps", async ({
  appPage,
  page,
}) => {
  const response = await page.goto("/capabilities", { waitUntil: "domcontentloaded" });

  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Page Not Found" })).toBeVisible();

  await page.goto("/discover", { waitUntil: "domcontentloaded" });
  await page
    .getByRole("region", { name: "Teammates, apps and automations" })
    .getByRole("link", { name: "Browse the catalogue", exact: true })
    .click();
  await expect(page).toHaveURL(/\/apps$/);

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await appPage.followSidebarLink("Capabilities");
  await expect(page).toHaveURL(/\/apps$/);
});
