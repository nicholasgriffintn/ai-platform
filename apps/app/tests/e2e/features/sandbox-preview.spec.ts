import { expect, test } from "../fixtures/polychat-test";
import { SandboxApi } from "../fixtures/sandbox-api";
import { SUPERVISED_SANDBOX_ENVIRONMENT } from "../fixtures/sandbox-environment";
import { SandboxPreviewPage } from "../page-objects/SandboxPreviewPage";
import { WorkbenchPage } from "../page-objects/WorkbenchPage";
import { E2E_APP_BASE_URL } from "../support/environment";

test.describe("Private sandbox previews", () => {
  test.use({ persona: "pro" });

  test("opens one-time access to a healthy service and denies replay and revoked access", async ({
    page,
    context,
    workPage,
    homePage,
  }) => {
    test.setTimeout(120_000);
    await workPage.openProjectFromWorkspace("Release Workspace", "Release Project");
    const sandbox = new SandboxApi(page.request, workPage.currentProjectId());
    const workbench = new WorkbenchPage(page);

    await sandbox.configureProject(SUPERVISED_SANDBOX_ENVIRONMENT);
    await workPage.reload();
    await workPage.openNewProjectConversation();
    await homePage.selectModel("GPT OSS 120B");
    await homePage.sendMessage(
      "Polychat sandbox E2E: wait for controls while reviewing the service.",
    );
    await expect.poll(async () => (await sandbox.latestRun())?.runId).toBeTruthy();
    const run = await sandbox.latestRun();

    if (!run) {
      throw new Error("The preview run was not recorded");
    }

    await expect
      .poll(
        async () =>
          (await sandbox.events(run.runId)).some(({ event }) => event.type === "script_started"),
        { timeout: 30_000 },
      )
      .toBe(true);
    await workbench.control("Pause");
    await expect.poll(async () => (await sandbox.control(run.runId)).state).toBe("paused");
    expect((await sandbox.createPreview(run.runId, "undeclared")).status()).toBe(409);
    expect((await sandbox.createPreview(run.runId, "watcher")).status()).toBe(409);
    const access = await sandbox.preview(run.runId, "fixture");

    expect(access.state).toBe("healthy");
    expect(access.url).toBeTruthy();
    if (!access.url) {
      throw new Error("The healthy service did not provide preview access");
    }

    const url = new URL(access.url);

    expect(url.hostname).toMatch(/^[a-z0-9]{24}\.localhost$/);
    expect(url.pathname).toBe("/__polychat/preview/open");
    const previewTab = await context.newPage();
    const preview = new SandboxPreviewPage(previewTab);
    const altered = new URL(access.url);
    const grant = altered.searchParams.get("grant");

    if (!grant) {
      throw new Error("The preview URL is missing its bootstrap grant");
    }

    const parts = grant.split(".");

    parts[2] = `${parts[2]?.startsWith("a") ? "b" : "a"}${parts[2]?.slice(1)}`;
    altered.searchParams.set("grant", parts.join("."));
    expect((await preview.open(altered.href))?.status()).toBeGreaterThanOrEqual(400);
    await expect(preview.serviceHeading).not.toBeVisible();
    const wrongOrigin = new URL(access.url);

    wrongOrigin.hostname = `${"0".repeat(24)}.localhost`;
    expect((await preview.open(wrongOrigin.href))?.status()).toBeGreaterThanOrEqual(400);
    await expect(preview.serviceHeading).not.toBeVisible();
    const response = await preview.open(access.url);

    await expect(preview.serviceHeading).toBeVisible();
    expect(new URL(previewTab.url()).pathname).toBe("/");
    expect(response?.headers()["cache-control"]).toContain("no-store");
    expect(response?.headers()["content-security-policy"]).toContain(
      `frame-ancestors ${E2E_APP_BASE_URL}`,
    );
    const cookies = await context.cookies(url.origin);
    const cookie = cookies.find(({ name }) => name === "__Host-polychat_preview");

    expect(cookie).toMatchObject({ secure: true, httpOnly: true, domain: url.hostname, path: "/" });
    const replay = await preview.open(access.url);

    expect(replay?.status()).toBeGreaterThanOrEqual(400);
    await expect(preview.serviceHeading).not.toBeVisible();
    await preview.open(url.origin);
    await expect(preview.serviceHeading).toBeVisible();
    await sandbox.revokePreview(run.runId, access.previewId);
    const revoked = await preview.open(url.origin);

    expect(revoked?.status()).toBeGreaterThanOrEqual(400);
    await expect(preview.serviceHeading).not.toBeVisible();
    await previewTab.close();
    await workbench.selectPane("Preview");
    await workbench.startPreview();
    const embeddedHeading = workbench.previewFrame.getByRole("heading", {
      name: "Sandbox service ready",
      exact: true,
    });

    await expect(embeddedHeading).toBeVisible();
    await workbench.previewViewport("Mobile");
    await expect(
      page.getByRole("button", { name: "Mobile viewport", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await workbench.navigatePreview("/review?source=e2e");
    await expect(embeddedHeading).toBeVisible();
    await workbench.markPreviewRegion();
    await workbench.sendPreviewFeedback("Keep the preview heading readable.", "Service heading");
    await expect
      .poll(
        async () =>
          (await sandbox.instructions(run.runId)).filter(({ instruction }) =>
            instruction.content.includes("Keep the preview heading readable."),
          ).length,
      )
      .toBe(1);
    const feedback = (await sandbox.instructions(run.runId)).find(({ instruction }) =>
      instruction.content.includes("Keep the preview heading readable."),
    );

    expect(feedback?.instruction.kind).toBe("message");
    expect(feedback?.instruction.content).toContain("Service: fixture");
    expect(feedback?.instruction.content).toContain("Route: /review?source=e2e");
    expect(feedback?.instruction.content).toContain("Viewport: Mobile (390 × 844)");
    expect(feedback?.instruction.content).toContain("Region: x ");
    expect(feedback?.instruction.content).toContain("Element: Service heading");
    expect(feedback?.instruction.content).not.toContain("grant=");
    await workbench.selectPane("Activity");
    await expect(workbench.panel).toContainText("Keep the preview heading readable.");
    await workbench.reload();
    await expect(workbench.panel).toContainText("Keep the preview heading readable.");
    await workbench.control("Cancel");
    await expect
      .poll(async () => (await sandbox.latestRun())?.status, { timeout: 40_000 })
      .toBe("cancelled");
  });
});
