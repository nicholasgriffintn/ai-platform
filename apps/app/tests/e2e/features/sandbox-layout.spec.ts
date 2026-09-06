import { expect, test } from "../fixtures/polychat-test";
import { SandboxApi } from "../fixtures/sandbox-api";
import { WorkbenchPage } from "../page-objects/WorkbenchPage";

test.describe("Project workbench layout", () => {
  test.use({ persona: "pro" });

  test("keeps ordinary conversations simple and restores keyboard-resized panels across desktop and mobile", async ({
    page,
    workPage,
  }) => {
    await workPage.openProjectFromWorkspace("Release Workspace", "Release Project");
    const projectUrl = page.url();
    const sandbox = new SandboxApi(page.request, workPage.currentProjectId());
    const workbench = new WorkbenchPage(page);

    await workPage.openNewProjectConversation();
    await expect(workbench.dock).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Pause", exact: true })).not.toBeVisible();
    await expect(workbench.mobileTrigger).not.toBeVisible();
    await sandbox.configureProject();
    await workPage.navigate(projectUrl);
    await workPage.openNewProjectConversation();
    await expect(workbench.dock).toBeVisible();
    await expect(page.getByRole("main", { name: "Conversation", exact: true })).toBeVisible();
    await expect(workbench.dock.getByRole("tab")).toHaveText([
      "Activity",
      "Preview",
      "Changes",
      "Files",
      "Proof",
    ]);
    await expect(page.locator('output[aria-live="polite"]')).toContainText("Ready");
    await expect(workbench.resizeHandle).toHaveAttribute("aria-valuenow", /^\d+$/);
    const initialWidth = Number(await workbench.resizeHandle.getAttribute("aria-valuenow"));

    await workbench.paneTab("Activity").focus();
    await page.keyboard.press("Shift+Tab");
    await expect(workbench.resizeHandle).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(workbench.resizeHandle).toHaveAttribute(
      "aria-valuenow",
      String(initialWidth + 24),
    );
    await page.keyboard.press("Tab");
    await expect(workbench.paneTab("Activity")).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(workbench.paneTab("Preview")).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(workbench.paneTab("Changes")).toBeFocused();
    await expect(workbench.paneTab("Changes")).toHaveAttribute("aria-selected", "true");
    await workbench.collapse();
    await expect(workbench.dock).not.toBeVisible();
    await workbench.reload();
    await expect(workbench.dock).not.toBeVisible();
    await workbench.expand();
    await expect(workbench.resizeHandle).toHaveAttribute(
      "aria-valuenow",
      String(initialWidth + 24),
    );
    await expect(workbench.paneTab("Changes")).toHaveAttribute("aria-selected", "true");
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(workbench.dock).not.toBeVisible();
    await workbench.mobileTrigger.click();
    await expect(workbench.mobileDialog).toBeVisible();
    await expect(workbench.mobileDialog.getByRole("tab")).toHaveText([
      "Activity",
      "Preview",
      "Changes",
      "Files",
      "Proof",
    ]);
    await expect(
      workbench.mobileDialog.getByRole("tab", { name: "Changes", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    const dialogBounds = await workbench.mobileDialog.boundingBox();
    const viewportHeight = await page.evaluate(() => window.innerHeight);

    expect(dialogBounds?.height).toBeGreaterThan(viewportHeight * 0.9);
    await page.keyboard.press("Escape");
    await expect(workbench.mobileDialog).not.toBeVisible();
    await expect(workbench.mobileTrigger).toBeFocused();
  });
});
