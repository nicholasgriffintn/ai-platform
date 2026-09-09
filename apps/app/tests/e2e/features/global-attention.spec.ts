import { provisionPersonaBrowserContext } from "../fixtures/persona-provisioning";
import { expect, test } from "../fixtures/polychat-test";
import { ProjectTaskApi } from "../fixtures/project-task-api";
import { SandboxApi } from "../fixtures/sandbox-api";
import { WorkAttentionApi } from "../fixtures/work-attention-api";
import { AttentionPage } from "../page-objects/AttentionPage";
import { WorkPage } from "../page-objects/WorkPage";
import { E2E_APP_BASE_URL } from "../support/environment";

const QUEUED_RUN_TITLE = "Queued Workbench fixture";

test.describe("Attention across every authorised workspace", () => {
  test.use({ persona: "pro" });

  test("lists each eligible state with its own detail link and explains both empty results", async ({
    homePage,
    page,
    workPage,
  }) => {
    const attention = new AttentionPage(page);

    await workPage.openProjectFromWorkspace("Release Workspace", "Release Project");
    const workspaceId = workPage.currentWorkspaceId();
    const projectId = workPage.currentProjectId();
    const taskApi = new ProjectTaskApi(page.request, projectId);
    const attentionApi = new WorkAttentionApi(page.request);
    const sandbox = new SandboxApi(page.request, projectId);

    await attention.open();
    await expect(attention.emptyResult("Nothing needs attention")).toBeVisible();

    const review = await taskApi.createWithStatus("Review the release evidence", "review");
    const stalled = await taskApi.createWithStatus("Unblock the stalled release work", "blocked");
    const running = await taskApi.createWithStatus("Work through the release checklist", "queued");
    const completed = await taskApi.createWithStatus("Publish the release notes", "done");

    await workPage.navigate(`/work/${workspaceId}/projects/${projectId}`);
    await workPage.openNewProjectConversation();
    await homePage.selectModel("GPT OSS 120B");
    const conversationId = homePage.completionIdFromRequest(
      await homePage.sendMessageAndRequireCompletion("Open the attention run conversation"),
    );

    await sandbox.createQueuedWorkbenchRun(conversationId, "Keep this attention run queued");

    await attention.open();
    await expect(attention.rows).toHaveCount(5);
    await expect(attention.item(review.objective)).toContainText("In review");
    await expect(attention.item(stalled.objective)).toContainText("Failed or stalled");
    await expect(attention.item(running.objective)).toContainText("Running");
    await expect(attention.item(completed.objective)).toContainText("Recently completed");
    await expect(attention.item(QUEUED_RUN_TITLE)).toContainText("Running");
    await expect(attention.item(review.objective)).toContainText("Release Workspace");

    const occurredAt = await attentionApi.occurredAtByTitle();
    const rendered = await attention.titles();

    expect(rendered.filter((title) => occurredAt.has(title))).toHaveLength(5);
    const order = rendered.map((title) => occurredAt.get(title) ?? "");

    expect(order).toEqual([...order].sort().reverse());

    await attention.item(review.objective).click();
    await page.waitForURL(`**/projects/${projectId}/tasks/${review.id}`);
    await expect(page.getByRole("heading", { name: review.objective, level: 1 })).toBeVisible();

    await attention.open();
    await attention.item(QUEUED_RUN_TITLE).click();
    await page.waitForURL(`**/work/${workspaceId}/projects/${projectId}/chat/${conversationId}`);
    await expect(homePage.chatInput).toBeEditable();

    await attention.open("?from=2000-01-01&to=2000-01-02");
    await expect(attention.emptyResult("No work matches these filters")).toBeVisible();
    await expect(attention.rows).toHaveCount(0);
  });

  test("keeps attention filters in the address, restores them in a second session and clears them", async ({
    browser,
    page,
    workPage,
  }) => {
    const attention = new AttentionPage(page);

    await workPage.openProjectFromWorkspace("Release Workspace", "Release Project");
    const workspaceId = workPage.currentWorkspaceId();
    const projectId = workPage.currentProjectId();
    const taskApi = new ProjectTaskApi(page.request, projectId);

    await taskApi.createWithStatus("Review the filtered release", "review");
    await taskApi.createWithStatus("Review the second filtered release", "review");
    await taskApi.createWithStatus("Unblock the filtered release work", "blocked");

    await attention.open();
    await expect(attention.rows).toHaveCount(3);

    await attention.filterBy("State", "In review");
    await expect(page).toHaveURL(/[?&]kind=review/);
    await expect(attention.rows).toHaveCount(2);

    await attention.filterBy("Workspace", "Release Workspace");
    await expect(page).toHaveURL(new RegExp(`workspaceId=${workspaceId}`));
    await attention.filterBy("Type", "Project task");
    await expect(page).toHaveURL(/[?&]type=task/);
    await expect(attention.rows).toHaveCount(2);

    const filteredSearch = attention.search();

    await attention.reload();
    await expect(attention.rows).toHaveCount(2);
    expect(attention.search()).toBe(filteredSearch);

    const secondContext = await browser.newContext({
      baseURL: E2E_APP_BASE_URL,
      storageState: await page.context().storageState(),
    });

    try {
      const secondPage = await secondContext.newPage();
      const secondAttention = new AttentionPage(secondPage);

      await secondAttention.open(filteredSearch);
      await expect(secondAttention.rows).toHaveCount(2);
      expect(await secondAttention.titles()).toEqual(await attention.titles());
    } finally {
      await secondContext.close();
    }

    await attention.open("?kind=not-a-state&type=nonsense");
    await expect(attention.rows).toHaveCount(3);
    expect(attention.search()).toBe("?kind=not-a-state&type=nonsense");

    await attention.open("?kind=review&limit=1&offset=1");
    await expect(attention.rows).toHaveCount(1);
    await expect(attention.pagination).toContainText("2–2 of 2");
    await attention.clearFilters();
    await expect(page).toHaveURL(/\?limit=1$/);
    await expect(attention.pagination).toContainText("1–1 of 3");
    await expect(attention.rows).toHaveCount(1);
  });

  test("pages tied attention items forwards and backwards without losing or repeating one", async ({
    page,
    workPage,
  }) => {
    const attention = new AttentionPage(page);

    await workPage.openProjectFromWorkspace("Release Workspace", "Release Project");
    const taskApi = new ProjectTaskApi(page.request, workPage.currentProjectId());

    for (const index of [1, 2, 3, 4, 5]) {
      await taskApi.createWithStatus(`Review release batch item ${index}`, "review");
    }

    await attention.open("?limit=2");
    await expect(attention.rows).toHaveCount(2);
    await expect(attention.pagination).toContainText("1–2 of 5");
    const firstPage = await attention.titles();

    await attention.goToNextPage();
    await expect(attention.pagination).toContainText("3–4 of 5");
    await expect(attention.rows).toHaveCount(2);
    const secondPage = await attention.titles();

    await attention.goToNextPage();
    await expect(attention.pagination).toContainText("5–5 of 5");
    await expect(attention.rows).toHaveCount(1);
    const thirdPage = await attention.titles();

    await attention.goToPreviousPage();
    await expect(attention.pagination).toContainText("3–4 of 5");
    expect(await attention.titles()).toEqual(secondPage);

    await attention.goToPreviousPage();
    await expect(attention.pagination).toContainText("1–2 of 5");
    expect(await attention.titles()).toEqual(firstPage);

    const paged = [...firstPage, ...secondPage, ...thirdPage];

    expect(new Set(paged).size).toBe(5);
  });

  test("drops a revoked workspace from attention rows, its facets and its detail links", async ({
    browser,
    page,
    workPage,
  }) => {
    await workPage.openProjectFromWorkspace("Release Workspace", "Release Project");
    const projectId = workPage.currentProjectId();
    const projectPath = new URL(page.url()).pathname;
    const taskApi = new ProjectTaskApi(page.request, projectId);
    const task = await taskApi.createWithStatus("Review the shared release evidence", "review");
    const member = await provisionPersonaBrowserContext(
      browser,
      "pro",
      `${test.info().testId}:attention-member`,
    );

    try {
      const memberPage = await member.context.newPage();
      const memberWork = new WorkPage(memberPage);
      const memberAttention = new AttentionPage(memberPage);
      const memberTasks = new ProjectTaskApi(member.context.request, projectId);

      await workPage.navigate(projectPath);
      await workPage.openProjectSurface("People");
      await memberWork.acceptInvitation(await workPage.createMemberInvitation(member.email));

      await memberAttention.open();
      await expect(memberAttention.item(task.objective)).toBeVisible();
      expect(await memberAttention.facetOptions("Workspace")).toContain("Release Workspace");
      expect(await memberTasks.detailStatus(task.id)).toBe(200);

      await workPage.promoteAndRemoveMember(member.email);

      await memberAttention.open();
      await expect(memberAttention.emptyResult("Nothing needs attention")).toBeVisible();
      await expect(memberAttention.item(task.objective)).toHaveCount(0);
      expect(await memberAttention.facetOptions("Workspace")).toEqual(["All"]);
      expect(await memberAttention.facetOptions("Project")).toEqual(["All"]);
      expect(await memberTasks.detailStatus(task.id)).toBe(404);
    } finally {
      await member.context.close();
    }
  });
});
