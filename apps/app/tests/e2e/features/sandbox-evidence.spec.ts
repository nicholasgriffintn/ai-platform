import { provisionPersonaBrowserContext } from "../fixtures/persona-provisioning";
import { expect, test } from "../fixtures/polychat-test";
import { SandboxApi } from "../fixtures/sandbox-api";
import { WorkbenchPage } from "../page-objects/WorkbenchPage";
import { WorkPage } from "../page-objects/WorkPage";

test.describe("Sandbox run evidence", () => {
  test.use({ persona: "pro" });

  test("reviews an ordered multi-file diff and revokes private outputs with membership", async ({
    page,
    browser,
    workPage,
    homePage,
  }) => {
    test.setTimeout(150_000);
    const member = await provisionPersonaBrowserContext(
      browser,
      "pro",
      `${test.info().testId}:member`,
    );

    try {
      await workPage.openProjectFromWorkspace("Release Workspace", "Release Project");
      const projectUrl = page.url();
      const projectId = workPage.currentProjectId();
      const sandbox = new SandboxApi(page.request, projectId);
      const workbench = new WorkbenchPage(page);

      await sandbox.configureProject();
      await workPage.openProjectSurface("People");
      const peopleUrl = page.url();
      const invitation = await workPage.createMemberInvitation(member.email);
      const memberTab = await member.context.newPage();
      const memberWork = new WorkPage(memberTab);
      const memberWorkbench = new WorkbenchPage(memberTab);

      await memberWork.acceptInvitation(invitation);
      await workPage.navigate(projectUrl);
      await workPage.openNewProjectConversation();
      await homePage.selectModel("GPT OSS 120B");
      await homePage.sendMessageAndRequireCompletion(
        "Polychat sandbox E2E: create multi-file evidence and validate the result.",
      );
      await expect
        .poll(async () => (await sandbox.latestRun())?.status, { timeout: 90_000 })
        .toBe("completed");
      const run = await sandbox.latestRun();

      if (!run) {
        throw new Error("The multi-file run was not retained");
      }

      expect(run.manifest?.changes.files).toEqual([
        "README.md",
        "assets/logo.bin",
        "config/schema.json",
        "src/consumer.js",
        "tests/consumer.test.js",
      ]);
      await workbench.selectPane("Changes");
      await expect(workbench.panel).toContainText("5 files");
      await expect(workbench.changesIn("config/schema.json")).toBeVisible();
      await expect(workbench.changesIn("config/schema.json")).toContainText('"status": "draft"');
      await expect(workbench.changesIn("config/schema.json")).toContainText('"status": "verified"');
      await workbench.nextChangedFile.click();
      await expect(workbench.changesIn("assets/logo.bin")).toContainText("Binary change");
      await workbench.nextChangedFile.click();
      await expect(workbench.changesIn("README.md")).toBeVisible();
      await workbench.nextChangedFile.click();
      await expect(workbench.changesIn("src/consumer.js")).toBeVisible();
      await workbench.nextChangedFile.click();
      await expect(workbench.changesIn("tests/consumer.test.js")).toBeVisible();
      await expect(workbench.nextChangedFile).toBeDisabled();
      await workbench.changedFileSearch.fill("consumer.test");
      await expect(workbench.changesIn("tests/consumer.test.js")).toBeVisible();
      await expect(workbench.previousChangedFile).toBeDisabled();
      await expect(workbench.nextChangedFile).toBeDisabled();
      await workbench.changedFileSearch.fill("missing-file");
      await expect(workbench.panel).toContainText("No matching files");
      await workbench.changedFileSearch.fill("schema");
      const context = workbench.changesIn("config/schema.json").locator("details").first();

      await expect(context).toHaveAttribute("open", "");
      await context.locator("summary").focus();
      await page.keyboard.press("Enter");
      await expect(context).not.toHaveAttribute("open", "");
      await page.setViewportSize({ width: 390, height: 844 });
      await workbench.mobileTrigger.click();
      await expect(workbench.mobileDialog).toBeVisible();
      await workbench.paneTab("Changes").click();
      await workbench.changedFileSearch.fill("schema");
      const narrowContext = workbench.changesIn("config/schema.json").locator("details").first();

      await narrowContext.locator("summary").focus();
      await page.keyboard.press("Enter");
      await expect(narrowContext).not.toHaveAttribute("open", "");
      await page.keyboard.press("Escape");
      await page.setViewportSize({ width: 1440, height: 900 });
      const conversationUrl = page.url();

      await memberWork.navigate(conversationUrl);
      await memberWorkbench.selectPane("Files");
      await memberWorkbench.changedFileEvidence("config/schema.json").click();
      await expect(memberWorkbench.artifactPreview("config/schema.json")).toContainText(
        '"status": "verified"',
      );
      await memberWorkbench.changedFileEvidence("assets/logo.bin").click();
      await expect(memberWorkbench.panel).toContainText("Binary file");
      await expect(memberWorkbench.panel).toContainText("cannot be decoded safely as text");
      const logs = run.manifest?.artifacts.find(({ kind }) => kind === "logs");
      const events = run.manifest?.artifacts.find(({ kind }) => kind === "events");
      const diff = run.manifest?.artifacts.find(({ kind }) => kind === "diff");

      if (!logs || !events || !diff) {
        throw new Error("The multi-file run is missing private evidence");
      }

      await memberWorkbench.artifact(logs.name).click();
      await expect(memberWorkbench.artifactPreview(logs.name)).toBeVisible();
      const previewText = await memberWorkbench
        .artifactPreview(logs.name)
        .locator("code")
        .innerText();

      expect(new TextEncoder().encode(previewText).byteLength).toBeLessThanOrEqual(1_000_000);
      expect((await member.context.request.get(diff.url)).status()).toBe(200);
      expect((await member.context.request.get(logs.url)).status()).toBe(200);
      await workPage.navigate(peopleUrl);
      await workPage.promoteAndRemoveMember(member.email);
      await memberWorkbench.artifact(events.name).click();
      await expect(memberWorkbench.panel).toContainText("Artifact unavailable");
      expect((await member.context.request.get(diff.url)).status()).toBe(404);
      expect((await member.context.request.get(logs.url)).status()).toBe(404);
    } finally {
      await member.context.close();
    }
  });
});
