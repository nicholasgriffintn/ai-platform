import { provisionPersonaBrowserContext } from "../fixtures/persona-provisioning";
import { expect, test } from "../fixtures/polychat-test";
import { SandboxApi } from "../fixtures/sandbox-api";
import { WorkbenchPage } from "../page-objects/WorkbenchPage";

test.describe("Sandbox Workbench", () => {
  test.use({ persona: "pro" });

  for (const scenario of [
    { name: "JavaScript edit", instruction: "use JavaScript", qualityGate: "passed" },
    { name: "Python edit", instruction: "use Python", qualityGate: "passed" },
    { name: "failed validation", instruction: "fail validation", qualityGate: "failed" },
  ]) {
    test(
      `restores persisted proof and enforces artefact access after ${scenario.name}`,
      { tag: scenario.name === "JavaScript edit" ? ["@release"] : [] },
      async ({ page, browser, workPage, homePage }) => {
        test.setTimeout(120_000);
        await workPage.openProjectFromWorkspace("Release Workspace", "Release Project");
        const sandbox = new SandboxApi(page.request, workPage.currentProjectId());
        const workbench = new WorkbenchPage(page);

        await sandbox.configureProject();
        await workPage.reload();
        await workPage.openNewProjectConversation();
        await expect(workbench.dock).toBeVisible();
        await homePage.selectModel("GPT OSS 120B");
        await homePage.sendMessageAndRequireCompletion(
          `Polychat sandbox E2E: ${scenario.instruction} to update the fixture README and validate the result.`,
        );
        await expect
          .poll(async () => (await sandbox.latestRun())?.status, { timeout: 90_000 })
          .toMatch(/^(completed|failed|cancelled)$/);
        const run = await sandbox.latestRun();
        const logs = run?.manifest?.artifacts.find((artifact) => artifact.kind === "logs");

        if (logs) {
          await test.info().attach("sandbox-command-log", {
            body: await sandbox.artifact(logs.url),
            contentType: "text/plain",
          });
        }

        const events = run?.manifest?.artifacts.find((artifact) => artifact.kind === "events");

        if (events) {
          await test.info().attach("sandbox-events", {
            body: await sandbox.artifact(events.url),
            contentType: "application/x-ndjson",
          });
        }

        expect(run?.status, run?.error).toBe("completed");
        expect(run?.manifest).toBeDefined();
        expect(run?.manifest?.validation.qualityGate, JSON.stringify(run?.manifest)).toBe(
          scenario.qualityGate,
        );
        const diff = run?.manifest?.artifacts.find((artifact) => artifact.kind === "diff");

        expect(diff).toBeDefined();
        if (!diff) {
          throw new Error("The completed sandbox run did not persist its diff");
        }

        expect(await sandbox.artifact(diff.url)).toContain(
          scenario.qualityGate === "failed" ? "Sandbox E2E invalid." : "Sandbox E2E verified.",
        );
        expect(run?.manifest?.repository.baseRevision).toMatch(/^[a-f0-9]{40}$/);
        expect(run?.manifest?.changes.files).toContain("README.md");
        expect(run?.manifest?.delivery.policy?.mode).toBe("leave_uncommitted");
        expect(run?.manifest?.delivery.commit).toBeUndefined();
        await workbench.selectPane("Proof");
        await expect(workbench.panel).toContainText("README.md");
        await expect(workbench.panel).toContainText("Validation");
        await workbench.reload();
        await expect(page.getByRole("tab", { name: "Proof", exact: true })).toHaveAttribute(
          "aria-selected",
          "true",
        );
        await expect(workbench.panel).toContainText("README.md");
        expect((await sandbox.latestRun())?.runId).toBe(run?.runId);
        await expect(workbench.panel).toContainText(`Quality gate ${scenario.qualityGate}`);
        await workbench.selectPane("Changes");
        await expect(workbench.panel).toContainText("README.md");
        const { context: outsiderContext } = await provisionPersonaBrowserContext(
          browser,
          "pro",
          `${test.info().testId}:outsider`,
        );

        try {
          const response = await outsiderContext.request.get(diff.url);

          expect(response.status()).toBe(404);
          expect(await response.text()).not.toContain("Sandbox E2E verified.");
        } finally {
          await outsiderContext.close();
        }
      },
    );
  }
});
