import { expect, test } from "../fixtures/polychat-test";
import { ProjectTaskApi } from "../fixtures/project-task-api";
import { SandboxApi } from "../fixtures/sandbox-api";
import { ProjectTasksPage } from "../page-objects/ProjectTasksPage";
import { chooseDropdownOption } from "../support/dropdown";

const REMOVED_PATHS = ["/attention", "/files", "/teammates"];

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

  test("keeps the chat shell while opening every personal place", async ({
    appPage,
    page,
    polychatApi,
  }) => {
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

    const made = await polychatApi.writeDocumentOutput(
      "Personal files place report",
      "Made in the personal Files place.",
    );

    await appPage.followSidebarLink("Files");
    const filesNav = page.getByRole("navigation", { name: "Files sections" });

    for (const [tab, content] of [
      ["Made", page.getByText(made.title, { exact: true })],
      ["Given", page.getByRole("heading", { name: "All sources", exact: true })],
      ["Memory", page.getByText("Nothing remembered yet", { exact: true })],
    ] as const) {
      await filesNav.getByRole("link", { name: tab, exact: true }).click();
      await expect(filesNav.getByRole("link", { name: tab, exact: true })).toHaveAttribute(
        "aria-current",
        "page",
      );
      await expect(content.first()).toBeVisible();
      await expect(page.getByRole("navigation", { name: "Conversations" })).toBeVisible();
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

  test("lists project work in Attention on both hosts and keeps a filter across a reload", async ({
    page,
    workPage,
  }) => {
    test.slow();
    const tasks = new ProjectTasksPage(page);

    await workPage.openProjectFromWorkspace("Release Workspace", "Release Project");
    const sandbox = new SandboxApi(page.request, workPage.currentProjectId());
    const taskApi = new ProjectTaskApi(page.request, workPage.currentProjectId());

    await sandbox.configureProject();
    const task = await taskApi.createQuestionTask();

    await tasks.openBoard();
    await tasks.reload();
    await tasks.openTask(task.objective);
    expect((await tasks.start()).ok()).toBe(true);

    await page.goto("/chat/attention", { waitUntil: "domcontentloaded" });
    const items = page.getByRole("list", { name: "Attention items" });

    await expect(items.getByRole("link", { name: task.objective })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByRole("heading", { name: "Your background tasks" })).toBeVisible();

    const filters = page.locator('[aria-label="Attention filters"]');

    await chooseDropdownOption(filters.getByLabel("Type", { exact: true }), "Project task");
    await expect(page).toHaveURL(/\/chat\/attention\?(?:.*&)?type=task/);
    await expect(items.getByRole("link", { name: task.objective })).toBeVisible();

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/type=task/);
    await expect(filters.getByLabel("Type", { exact: true })).toContainText("Project task");
    await expect(items.getByRole("link", { name: task.objective })).toBeVisible({
      timeout: 30_000,
    });

    await chooseDropdownOption(filters.getByLabel("Type", { exact: true }), "Coding run");
    await expect(page.getByText("No work matches these filters", { exact: true })).toBeVisible();
    await filters.getByRole("button", { name: "Clear filters", exact: true }).click();
    await expect(page).toHaveURL(/\/chat\/attention$/);
    await expect(items.getByRole("link", { name: task.objective })).toBeVisible();

    await page.goto("/work/attention", { waitUntil: "domcontentloaded" });
    await expect(items.getByRole("link", { name: task.objective })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByRole("heading", { name: "Your background tasks" })).toBeVisible();
    await items.getByRole("link", { name: task.objective }).click();
    await expect(page).toHaveURL(new RegExp(`/tasks/${task.id}$`));
  });

  test("keeps the retired project places and the conversation query fallback out of the shell", async ({
    homePage,
    page,
    polychatApi,
    workPage,
  }) => {
    await workPage.openProjectFromWorkspace("Release Workspace", "Release Project");
    const projectPath = new URL(page.url()).pathname;
    const output = await polychatApi.writeDocumentOutput(
      "Retired places output",
      "Reachable only through Files.",
    );

    for (const path of [`${projectPath}/sources`, `/outputs/${output.id}`]) {
      const response = await page.goto(path, { waitUntil: "domcontentloaded" });

      expect(response?.status(), `${path} must not resolve`).toBe(404);
      await expect(page.getByRole("heading", { name: "Page Not Found" })).toBeVisible();
    }

    await page.goto(`${projectPath}/chat?completion_id=${crypto.randomUUID()}`, {
      waitUntil: "domcontentloaded",
    });
    await expect(homePage.chatInput).toBeEditable();
    await expect(homePage.chatInput).toHaveValue("");
    await expect(page.locator('[data-role="user"]')).toHaveCount(0);
    await expect(page).not.toHaveURL(/\/chat\/[0-9a-f-]{36}/);
  });
});

test.describe("Places for an account without Work", () => {
  test.use({ persona: "free" });

  test("shows the workspace access empty state on Attention rather than an error", async ({
    page,
  }) => {
    await page.goto("/chat/attention", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: "Attention", level: 1 }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Unlock shared workspaces." })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Your background tasks" })).toBeVisible();
    await expect(page.locator('[aria-label="Attention filters"]')).toHaveCount(0);
  });
});

test("offers sign-in from the personal Files empty state", async ({ authPage, page }) => {
  await page.goto("/chat/files", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { name: "Sign in to view saved outputs" })).toBeVisible();
  await page.getByRole("button", { name: "Sign in", exact: true }).first().click();
  await authPage.waitForLoginModal();
  expect(await authPage.isLoginModalVisible()).toBe(true);
});
