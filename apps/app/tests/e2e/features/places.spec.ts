import { expect, test } from "../fixtures/polychat-test";

const REMOVED_PATHS = [
  "/attention",
  "/files",
  "/teammates",
  "/chat/capabilities",
  "/chat/experiences",
];

test("removes the top-level places rather than redirecting them", async ({ page }) => {
  for (const path of REMOVED_PATHS) {
    const response = await page.goto(path, { waitUntil: "domcontentloaded" });

    expect(response?.status(), `${path} must not resolve`).toBe(404);
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(page.getByRole("heading", { name: "Page Not Found" })).toBeVisible();
  }
});

test.describe("Places belong to a mode", () => {
  test.use({ persona: "pro" });

  test("keeps the chat shell while opening every personal place", async ({ appPage, page }) => {
    await page.goto("/chat", { waitUntil: "domcontentloaded" });

    for (const [place, path] of [
      ["Attention", "/chat/attention"],
      ["Files", "/chat/files"],
      ["Teammates", "/chat/teammates"],
    ] as const) {
      await appPage.followSidebarLink(place);
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await expect(page.getByRole("navigation", { name: "Conversations" })).toBeVisible();
      await expect(
        page.getByRole("navigation", { name: "Conversations" }).getByRole("link", { name: place }),
      ).toHaveCount(1);
    }
  });

  test("keeps the work shell and the open project while opening its places", async ({
    page,
    workPage,
  }) => {
    await workPage.openProjectFromWorkspace("Release Workspace", "Release Project");
    const projectPath = new URL(page.url()).pathname;
    const sidebar = page.getByRole("navigation", { name: "Workspace" });

    for (const [place, suffix] of [
      ["Files", "/files"],
      ["Teammates", "/teammates"],
    ] as const) {
      await expect(sidebar.getByRole("link", { name: place, exact: true })).toHaveCount(1);
      await sidebar.getByRole("link", { name: place, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`${projectPath}${suffix}`));
      await expect(sidebar).toBeVisible();
      await expect(sidebar.getByRole("link", { name: "Release Project" })).toBeVisible();
    }

    await sidebar.getByRole("link", { name: "Files", exact: true }).click();
    const filesNav = page.getByRole("navigation", { name: "Files sections" });

    for (const tab of ["Given", "Made", "Memory"] as const) {
      await filesNav.getByRole("link", { name: tab, exact: true }).click();
      await expect(filesNav.getByRole("link", { name: tab, exact: true })).toHaveAttribute(
        "aria-current",
        "page",
      );
      await expect(sidebar.getByRole("link", { name: "Files", exact: true })).toHaveAttribute(
        "aria-current",
        "page",
      );
    }

    await sidebar.getByRole("link", { name: "Attention", exact: true }).click();
    await expect(page).toHaveURL(/\/work\/attention\?projectId=/);
    await expect(sidebar).toBeVisible();
  });

  test("opens a project on its conversations and keeps configuration behind the gear", async ({
    page,
    workPage,
  }) => {
    await workPage.openProjectFromWorkspace("Release Workspace", "Release Project");

    const tabs = page.getByRole("navigation", { name: "Project sections" });

    await expect(tabs.getByRole("link", { name: "Chat" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("heading", { name: "Release Project" })).toBeVisible();

    for (const tab of ["Tasks", "Files", "Chat"] as const) {
      await tabs.getByRole("link", { name: tab, exact: true }).click();
      await expect(tabs.getByRole("link", { name: tab, exact: true })).toHaveAttribute(
        "aria-current",
        "page",
      );
      await expect(page.getByRole("heading", { name: "Release Project" })).toBeVisible();
    }

    await page.getByRole("link", { name: "Project settings" }).click();
    await expect(page).toHaveURL(/\/settings$/);

    for (const card of [
      "Project brief",
      "Default model tier",
      "Project memory",
      "Scheduled recipes",
      "Coding repository",
      "Teammates",
    ]) {
      await expect(page.getByRole("heading", { name: card, exact: true })).toBeVisible();
    }

    await page.getByRole("link", { name: "Back to project" }).click();
    await expect(tabs.getByRole("link", { name: "Chat" })).toHaveAttribute("aria-current", "page");
  });
});
