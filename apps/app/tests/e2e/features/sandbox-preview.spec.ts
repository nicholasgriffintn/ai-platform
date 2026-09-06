import { sandboxPreviewAccessSchema } from "@ngriffin_uk/polychat-schemas";

import { expect, test } from "../fixtures/polychat-test";
import { SandboxApi } from "../fixtures/sandbox-api";
import { SUPERVISED_SANDBOX_ENVIRONMENT } from "../fixtures/sandbox-environment";
import { SandboxPreviewPage } from "../page-objects/SandboxPreviewPage";
import { WorkbenchPage } from "../page-objects/WorkbenchPage";
import { E2E_APP_BASE_URL } from "../support/environment";
import { replaceSandboxPreviewGrantIdentity } from "../support/sandbox-preview-grant";

test.describe("Private sandbox previews", () => {
  test.use({ persona: "pro" });

  test("opens one-time access to a healthy service and denies replay and revoked access", async ({
    page,
    context,
    workPage,
    homePage,
    polychatApi,
  }) => {
    test.setTimeout(120_000);
    const browserMessages: string[] = [];

    page.on("console", (message) => browserMessages.push(message.text()));
    context.on("page", (browserPage) =>
      browserPage.on("console", (message) => browserMessages.push(message.text())),
    );
    await workPage.openProjectFromWorkspace("Release Workspace", "Release Project");
    const sandbox = new SandboxApi(page.request, workPage.currentProjectId());
    const workbench = new WorkbenchPage(page);
    const currentUser = await polychatApi.currentUser();

    if (!currentUser) {
      throw new Error("The preview runner is not signed in");
    }

    await sandbox.configureProject(SUPERVISED_SANDBOX_ENVIRONMENT);
    await workPage.reload();
    await workPage.openNewProjectConversation();
    await expect(workbench.dock).toBeVisible();
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

    const unprivileged = await sandbox.authorisePreviewWithoutServicePrincipal(
      grant,
      url.hostname.split(".")[0] ?? "",
    );

    expect(unprivileged.status()).toBe(403);
    expect(await unprivileged.text()).not.toContain("forwardToken");

    const parts = grant.split(".");

    parts[2] = `${parts[2]?.startsWith("a") ? "b" : "a"}${parts[2]?.slice(1)}`;
    altered.searchParams.set("grant", parts.join("."));
    expect((await preview.open(altered.href))?.status()).toBeGreaterThanOrEqual(400);
    await expect(preview.serviceHeading).not.toBeVisible();
    const substitutedProject = new URL(access.url);

    substitutedProject.searchParams.set(
      "grant",
      replaceSandboxPreviewGrantIdentity(grant, "project_id", "project_elsewhere"),
    );
    expect((await preview.open(substitutedProject.href))?.status()).toBeGreaterThanOrEqual(400);
    await expect(preview.serviceHeading).not.toBeVisible();
    const substitutedRun = new URL(access.url);

    substitutedRun.searchParams.set(
      "grant",
      replaceSandboxPreviewGrantIdentity(grant, "run_id", "run_elsewhere"),
    );
    expect((await preview.open(substitutedRun.href))?.status()).toBeGreaterThanOrEqual(400);
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
    expect(cookie?.partitionKey).toBeTruthy();
    const securedHeaders = await preview.open(`${url.origin}/private-headers`);

    await expect(preview.serviceHeading).toBeVisible();
    expect(securedHeaders?.headers()["set-cookie"]).toBeUndefined();
    expect(securedHeaders?.headers().server).toBeUndefined();
    expect(securedHeaders?.headers()["x-powered-by"]).toBeUndefined();
    const safeRedirect = await preview.open(`${url.origin}/local-redirect`);

    expect(safeRedirect?.ok()).toBe(true);
    expect(new URL(previewTab.url()).origin).toBe(url.origin);
    await expect(preview.serviceHeading).toBeVisible();
    const externalRedirect = await preview.open(`${url.origin}/external-redirect`);

    expect(externalRedirect?.status()).toBe(502);
    expect(externalRedirect?.headers().location).toBeUndefined();
    await expect(preview.serviceHeading).not.toBeVisible();
    const undeclaredPortRedirect = await preview.open(`${url.origin}/undeclared-port-redirect`);

    expect(undeclaredPortRedirect?.status()).toBe(502);
    expect(undeclaredPortRedirect?.headers().location).toBeUndefined();
    await expect(preview.serviceHeading).not.toBeVisible();
    const replay = await preview.open(access.url);

    expect(replay?.status()).toBeGreaterThanOrEqual(400);
    await expect(preview.serviceHeading).not.toBeVisible();
    await preview.open(url.origin);
    await expect(preview.serviceHeading).toBeVisible();
    const socket = await previewTab.evaluateHandle(
      (origin) =>
        new Promise<WebSocket>((resolve, reject) => {
          const websocket = new WebSocket(origin.replace(/^http/, "ws") + "/socket");
          const timeout = window.setTimeout(
            () => reject(new Error("Preview WebSocket did not echo before revocation")),
            5_000,
          );

          websocket.addEventListener("open", () => websocket.send("before-revocation"));
          websocket.addEventListener("message", (event) => {
            if (event.data === "before-revocation") {
              window.clearTimeout(timeout);
              resolve(websocket);
            }
          });
          websocket.addEventListener("error", () => {
            window.clearTimeout(timeout);
            reject(new Error("Preview WebSocket failed before revocation"));
          });
        }),
      url.origin,
    );

    await sandbox.revokePreview(run.runId, access.previewId);
    const socketClosure = await socket.evaluate(
      (websocket) =>
        new Promise<{ code: number; reason: string }>((resolve, reject) => {
          const timeout = window.setTimeout(
            () => reject(new Error("Preview WebSocket remained open after revocation")),
            5_000,
          );

          websocket.addEventListener("message", () => {
            window.clearTimeout(timeout);
            reject(new Error("Preview WebSocket transferred data after revocation"));
          });
          websocket.addEventListener("close", (event) => {
            window.clearTimeout(timeout);
            resolve({ code: event.code, reason: event.reason });
          });
          websocket.send("after-revocation");
        }),
    );

    expect(socketClosure).toEqual({ code: 1008, reason: "Preview access ended" });
    await socket.dispose();
    const revoked = await preview.open(url.origin);

    expect(revoked?.status()).toBeGreaterThanOrEqual(400);
    await expect(preview.serviceHeading).not.toBeVisible();
    await previewTab.close();
    await workbench.selectPane("Preview");
    const embeddedResponse = await workbench.startPreview();
    const embeddedAccess = sandboxPreviewAccessSchema.parse(await embeddedResponse.json());
    const embeddedHeading = workbench.previewFrame.getByRole("heading", {
      name: "Sandbox service ready",
      exact: true,
    });

    await expect(embeddedHeading).toBeVisible();
    await workbench.previewViewport("Fit");
    await expect(workbench.previewViewportButton("Fit")).toHaveAttribute("aria-pressed", "true");
    await expect(workbench.previewShell).toContainText("Fit to panel");
    await workbench.previewViewport("Mobile");
    await expect(workbench.previewViewportButton("Mobile")).toHaveAttribute("aria-pressed", "true");
    await expect(workbench.previewShell).toContainText("390 × 844");
    await workbench.previewViewport("Tablet");
    await expect(workbench.previewViewportButton("Tablet")).toHaveAttribute("aria-pressed", "true");
    await expect(workbench.previewShell).toContainText("768 × 1024");
    await workbench.previewViewport("Desktop");
    await expect(workbench.previewViewportButton("Desktop")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(workbench.previewShell).toContainText("1280 × 800");

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(workbench.conversation).toBeVisible();
    await expect(workbench.mobileTrigger).toBeVisible();
    await workbench.mobileTrigger.click();
    await expect(workbench.mobileDialog).toBeVisible();
    await expect(workbench.previewShell).toBeVisible();
    await workbench.previewViewport("Fit");
    await expect(workbench.previewViewportButton("Fit")).toHaveAttribute("aria-pressed", "true");
    const dialogBounds = await workbench.mobileDialog.boundingBox();
    const frameBounds = await workbench.previewFrameElement.boundingBox();

    expect(frameBounds?.width).toBeLessThanOrEqual(dialogBounds?.width ?? 0);
    await page.keyboard.press("Escape");
    await expect(workbench.mobileDialog).not.toBeVisible();
    await expect(workbench.mobileTrigger).toBeFocused();
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(workbench.dock).toBeVisible();

    const externalTab = await workbench.openPreviewExternally();
    const externalPreview = new SandboxPreviewPage(externalTab);

    await expect(externalPreview.serviceHeading).toBeVisible();
    await externalTab.close();
    const parentUrl = page.url();
    const instructionCount = (await sandbox.instructions(run.runId)).length;

    await workbench.navigatePreview("/malicious");
    await expect(
      workbench.previewFrame.getByRole("heading", { name: "Sandbox attack probe", exact: true }),
    ).toBeVisible();
    await expect(workbench.previewAttackResults).toContainText('"cookieReadable":false');
    await expect(workbench.previewAttackResults).toContainText('"parentReadable":false');
    await expect(workbench.previewAttackResults).toContainText('"parentControlInvoked":false');
    await expect(workbench.previewAttackResults).toContainText('"parentNavigated":false');
    expect(page.url()).toBe(parentUrl);
    expect(await sandbox.instructions(run.runId)).toHaveLength(instructionCount);
    await expect(
      workbench.previewShell.getByText("Trusted review controls", { exact: true }),
    ).toBeVisible();
    const refreshedResponse = await workbench.refreshPreview();
    const refreshedAccess = sandboxPreviewAccessSchema.parse(await refreshedResponse.json());

    expect(refreshedAccess.previewId).not.toBe(embeddedAccess.previewId);
    expect(Date.parse(refreshedAccess.expiresAt)).toBeGreaterThan(
      Date.parse(embeddedAccess.expiresAt),
    );
    await expect(embeddedHeading).toBeVisible();
    await workbench.previewViewport("Mobile");
    await workbench.navigatePreview("/review?source=e2e");
    await expect(embeddedHeading).toBeVisible();
    await workbench.markPreviewRegion();
    await workbench.sendPreviewFeedback("Keep the preview heading readable.", "Service heading");
    await expect
      .poll(
        async () =>
          (await sandbox.instructions(run.runId)).filter(({ instruction }) =>
            instruction.content?.includes("Keep the preview heading readable."),
          ).length,
      )
      .toBe(1);
    const feedback = (await sandbox.instructions(run.runId)).find(({ instruction }) =>
      instruction.content?.includes("Keep the preview heading readable."),
    );

    expect(feedback?.instruction.kind).toBe("message");
    expect(feedback?.instruction.createdByUserId).toBe(currentUser.id);
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
    const terminalAccess = await sandbox.preview(run.runId, "fixture");

    if (!terminalAccess.url) {
      throw new Error("The terminal revocation check did not receive preview access");
    }

    const terminalTab = await context.newPage();
    const terminalPreview = new SandboxPreviewPage(terminalTab);

    await terminalPreview.open(terminalAccess.url);
    await expect(terminalPreview.serviceHeading).toBeVisible();
    await workbench.control("Cancel");
    await expect
      .poll(async () => (await sandbox.latestRun())?.status, { timeout: 40_000 })
      .toBe("cancelled");
    const terminalDenied = await terminalPreview.open(new URL(terminalAccess.url).origin);

    expect(terminalDenied?.status()).toBeGreaterThanOrEqual(400);
    await expect(terminalPreview.serviceHeading).not.toBeVisible();
    const browserLog = browserMessages.join("\n");

    for (const sensitiveValue of [
      grant,
      cookie?.value,
      access.url,
      embeddedAccess.url,
      refreshedAccess.url,
      terminalAccess.url,
    ]) {
      if (sensitiveValue) {
        expect(browserLog).not.toContain(sensitiveValue);
      }
    }
    expect(browserLog).not.toMatch(/forwardToken|ghs_|sk_|sandboxId|container(?:Id|Address)/i);
  });

  test("expires active preview access after five minutes", async ({ page, workPage, homePage }) => {
    test.setTimeout(420_000);
    await workPage.openProjectFromWorkspace("Release Workspace", "Release Project");
    const sandbox = new SandboxApi(page.request, workPage.currentProjectId());
    const workbench = new WorkbenchPage(page);

    await sandbox.configureProject(SUPERVISED_SANDBOX_ENVIRONMENT, 600);
    await workPage.reload();
    await workPage.openNewProjectConversation();
    await homePage.selectModel("GPT OSS 120B");
    await homePage.sendMessage(
      "Polychat sandbox E2E: wait for controls while preview access expires.",
    );
    await expect.poll(async () => (await sandbox.latestRun())?.runId).toBeTruthy();
    const run = await sandbox.latestRun();

    if (!run) {
      throw new Error("The preview expiry run was not recorded");
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
    await workbench.selectPane("Preview");
    const previewResponse = await workbench.startPreview();
    const access = sandboxPreviewAccessSchema.parse(await previewResponse.json());

    if (!access.url) {
      throw new Error("The expiry check did not receive preview access");
    }

    expect(Date.parse(access.expiresAt) - Date.now()).toBeGreaterThan(290_000);
    await expect(
      workbench.previewFrame.getByRole("heading", { name: "Sandbox service ready", exact: true }),
    ).toBeVisible();
    await expect
      .poll(async () => (await workbench.reloadPreviewDocument())?.status() ?? 400, {
        timeout: 320_000,
        intervals: [15_000],
      })
      .toBeGreaterThanOrEqual(400);
    await expect(workbench.previewShell).toContainText("Preview expired");
  });
});
