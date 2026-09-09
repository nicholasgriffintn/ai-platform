import { provisionPersonaBrowserContext } from "../fixtures/persona-provisioning";
import { expect, test } from "../fixtures/polychat-test";
import { SANDBOX_E2E_REPOSITORIES, SandboxApi } from "../fixtures/sandbox-api";
import { HomePage } from "../page-objects/HomePage";
import { ProjectEnvironmentPage } from "../page-objects/ProjectEnvironmentPage";
import { WorkbenchPage } from "../page-objects/WorkbenchPage";
import { WorkPage } from "../page-objects/WorkPage";
import { chooseDropdownOption, expectDropdownValue } from "../support/dropdown";

test.describe("Sandbox delivery policy", () => {
  test.use({ persona: "pro" });

  test("maps legacy commit preferences without becoming more permissive", async ({
    page,
    workPage,
    projectState,
  }) => {
    await workPage.openProjectFromWorkspace("Release Workspace", "Release Project");
    const sandbox = new SandboxApi(page.request, workPage.currentProjectId());
    const environment = new ProjectEnvironmentPage(page);

    await sandbox.connectInstallation();
    await projectState.setLegacyDelivery(false);
    await workPage.reload();
    await environment.edit();
    await expectDropdownValue(environment.deliveryPolicy, "Leave changes uncommitted");
    await environment.cancelEdit();

    await projectState.setLegacyDelivery(true);
    await workPage.reload();
    await environment.edit();
    await expectDropdownValue(environment.deliveryPolicy, "Prepare a branch or pull request");
    await expectDropdownValue(environment.reviewDestination, "Push a review branch");
  });

  test("defaults new repositories to pull requests and retains every saved policy", async ({
    page,
    workPage,
  }) => {
    await workPage.openProjectFromWorkspace("Release Workspace", "Release Project");
    const sandbox = new SandboxApi(page.request, workPage.currentProjectId());
    const environment = new ProjectEnvironmentPage(page);

    await sandbox.connectInstallation();
    await workPage.reload();
    await environment.connect(SANDBOX_E2E_REPOSITORIES.delivery);
    await expectDropdownValue(environment.deliveryPolicy, "Prepare a branch or pull request");
    await expectDropdownValue(environment.reviewDestination, "Open a pull request");
    await environment.save();
    expect((await sandbox.project()).codingEnvironment?.deliveryPolicy).toEqual({
      mode: "review_branch",
      destination: "pull_request",
    });

    await environment.edit();
    await chooseDropdownOption(environment.reviewDestination, "Push a review branch");
    await environment.save();
    await workPage.reload();
    await environment.edit();
    await expectDropdownValue(environment.deliveryPolicy, "Prepare a branch or pull request");
    await expectDropdownValue(environment.reviewDestination, "Push a review branch");

    await chooseDropdownOption(environment.deliveryPolicy, "Leave changes uncommitted");
    await environment.save();
    await workPage.reload();
    await environment.edit();
    await expectDropdownValue(environment.deliveryPolicy, "Leave changes uncommitted");

    await chooseDropdownOption(environment.deliveryPolicy, "Commit to a configured branch");
    await environment.targetBranch.fill("release/e2e");
    await environment.save();
    await workPage.reload();
    await environment.edit();
    await expectDropdownValue(environment.deliveryPolicy, "Commit to a configured branch");
    await expect(environment.targetBranch).toHaveValue("release/e2e");

    await chooseDropdownOption(environment.deliveryPolicy, "Custom delivery instructions");
    await environment.deliveryInstructions.fill("Keep a local CUSTOM_LOCAL_PREPARATION marker.");
    await environment.save();
    await workPage.reload();
    await environment.edit();
    await expectDropdownValue(environment.deliveryPolicy, "Custom delivery instructions");
    await expect(environment.deliveryInstructions).toHaveValue(
      "Keep a local CUSTOM_LOCAL_PREPARATION marker.",
    );
    await environment.cancelEdit();
    await environment.disconnect();
    expect((await sandbox.project()).codingEnvironment).toBeNull();
    expect(
      (
        await sandbox.saveEnvironment(undefined, 120, SANDBOX_E2E_REPOSITORIES.delivery, {
          mode: "commit_to_branch",
          targetBranch: "main",
        })
      ).status(),
    ).toBe(400);
  });

  test("requires exact approval and records rejected delivery as incomplete without a remote write", async ({
    page,
    workPage,
    homePage,
  }) => {
    test.setTimeout(120_000);
    await workPage.openProjectFromWorkspace("Release Workspace", "Release Project");
    const sandbox = new SandboxApi(page.request, workPage.currentProjectId());
    const workbench = new WorkbenchPage(page);

    await sandbox.configureProject(undefined, 120, SANDBOX_E2E_REPOSITORIES.delivery, {
      mode: "review_branch",
      destination: "pull_request",
    });
    await workPage.reload();
    await workPage.openNewProjectConversation();
    await homePage.selectModel("GPT OSS 120B");
    await homePage.sendMessage("Polychat sandbox E2E: validate delivery and wait for approval.");
    await expect.poll(async () => (await sandbox.latestRun())?.runId).toBeTruthy();
    const run = await sandbox.latestRun();

    if (!run) {
      throw new Error("The rejected delivery run was not created");
    }

    await expect
      .poll(
        async () =>
          (await sandbox.instructions(run.runId)).find(
            ({ instruction }) => instruction.kind === "approval_request",
          )?.instruction.command,
        { timeout: 60_000 },
      )
      .toMatch(
        /^Repository: nicholasgriffintn\/polychat-e2e-delivery\nAction: Push review branch and open pull request\nBranch: polychat\/run-.+\nTarget: main\nCommit: [a-f0-9]{40}\nValidation: Quality gate passed \(1\/1 checks passed\)\.$/,
      );
    const approval = (await sandbox.instructions(run.runId)).find(
      ({ instruction }) => instruction.kind === "approval_request",
    );

    if (!approval) {
      throw new Error("The delivery approval was not retained");
    }

    expect(
      (await sandbox.events(run.runId)).some(({ event }) => event.type === "delivery_started"),
    ).toBe(false);
    await workbench.resolveApproval("Reject");
    await expect
      .poll(async () => (await sandbox.latestRun())?.status, { timeout: 60_000 })
      .toBe("completed");
    const completed = await sandbox.latestRun();
    const events = await sandbox.events(run.runId);

    expect(events.some(({ event }) => event.type === "delivery_skipped")).toBe(true);
    expect(events.some(({ event }) => event.type === "commit_push_started")).toBe(false);
    expect(completed?.manifest?.delivery.branch).toMatch(/^polychat\/run-/);
    expect(completed?.manifest?.delivery.commit).toMatch(/^[a-f0-9]{40}$/);
    expect(completed?.manifest?.delivery.pullRequestUrl).toBeUndefined();
    expect(completed?.manifest?.incompleteWork).toContain("Command approval rejected");
    await workbench.selectPane("Proof");
    await expect(workbench.panel).toContainText("Command approval rejected");
  });

  test("pushes an approved review branch and retains one pull request in Activity and Proof", async ({
    page,
    workPage,
    homePage,
  }) => {
    test.setTimeout(120_000);
    await workPage.openProjectFromWorkspace("Release Workspace", "Release Project");
    const sandbox = new SandboxApi(page.request, workPage.currentProjectId());
    const workbench = new WorkbenchPage(page);

    await sandbox.configureProject(undefined, 120, SANDBOX_E2E_REPOSITORIES.delivery, {
      mode: "review_branch",
      destination: "pull_request",
    });
    await workPage.reload();
    await workPage.openNewProjectConversation();
    await homePage.selectModel("GPT OSS 120B");
    await homePage.sendMessage("Polychat sandbox E2E: approve a pull request delivery.");
    await expect.poll(async () => (await sandbox.latestRun())?.runId).toBeTruthy();
    const run = await sandbox.latestRun();

    if (!run) {
      throw new Error("The pull request delivery run was not created");
    }

    await expect
      .poll(
        async () =>
          (await sandbox.instructions(run.runId)).some(
            ({ instruction }) => instruction.kind === "approval_request",
          ),
        { timeout: 60_000 },
      )
      .toBe(true);
    await workbench.resolveApproval("Approve");
    await expect
      .poll(async () => (await sandbox.latestRun())?.status, { timeout: 60_000 })
      .toBe("completed");
    const completed = await sandbox.latestRun();
    const events = await sandbox.events(run.runId);
    const deliveryEvents = events.filter(({ event }) => event.type === "delivery_completed");

    expect(deliveryEvents).toHaveLength(1);
    expect(events.some(({ event }) => event.type === "commit_pushed")).toBe(true);
    expect(completed?.manifest?.delivery.branch).toMatch(/^polychat\/run-/);
    expect(completed?.manifest?.delivery.commit).toMatch(/^[a-f0-9]{40}$/);
    expect(completed?.manifest?.delivery.pullRequestUrl).toBe(
      "https://github.com/nicholasgriffintn/polychat-e2e-delivery/pull/123",
    );
    await sandbox.redeliverRun(run.runId);
    await expect
      .poll(async () => sandbox.redeliveryState(run.runId), { timeout: 10_000 })
      .toBe("completed");
    await workbench.selectPane("Activity");
    await expect(workbench.panel).toContainText("Pull request");
    await expect(workbench.panel).toContainText("polychat/run-");
    await workbench.selectPane("Proof");
    await expect(workbench.panel).toContainText(
      "https://github.com/nicholasgriffintn/polychat-e2e-delivery/pull/123",
    );
    await workbench.reload();
    await expect(workbench.panel).toContainText(
      "https://github.com/nicholasgriffintn/polychat-e2e-delivery/pull/123",
    );
    expect(
      (await sandbox.events(run.runId)).filter(({ event }) => event.type === "delivery_completed"),
    ).toHaveLength(1);
  });

  for (const scenario of [
    {
      name: "repository default branch",
      repository: SANDBOX_E2E_REPOSITORIES.deliveryDefaultBranch,
      error: "Direct delivery cannot target the repository default branch",
    },
    {
      name: "protected branch",
      repository: SANDBOX_E2E_REPOSITORIES.deliveryProtected,
      error: "Direct delivery requires an existing non-protected branch",
    },
  ]) {
    test(`fails closed before work when direct delivery targets the ${scenario.name}`, async ({
      page,
      workPage,
      homePage,
    }) => {
      test.setTimeout(90_000);
      await workPage.openProjectFromWorkspace("Release Workspace", "Release Project");
      const sandbox = new SandboxApi(page.request, workPage.currentProjectId());

      await sandbox.configureProject(undefined, 120, scenario.repository, {
        mode: "commit_to_branch",
        targetBranch: "release/e2e",
      });
      await workPage.reload();
      await workPage.openNewProjectConversation();
      await homePage.selectModel("GPT OSS 120B");
      await homePage.sendMessage(`Polychat sandbox E2E: reject the ${scenario.name}.`);
      await expect
        .poll(async () => (await sandbox.latestRun())?.status, { timeout: 60_000 })
        .toBe("failed");
      const run = await sandbox.latestRun();

      expect(run?.manifest?.outcome.status).toBe("failed");
      expect(run?.manifest?.outcome).toMatchObject({
        error: expect.stringContaining(scenario.error),
      });
      expect(run?.manifest?.delivery.commit).toBeUndefined();
      expect(run?.manifest?.delivery.pullRequestUrl).toBeUndefined();
    });
  }

  test("rechecks branch protection after approval and blocks the write", async ({
    page,
    workPage,
    homePage,
  }) => {
    test.setTimeout(120_000);
    await workPage.openProjectFromWorkspace("Release Workspace", "Release Project");
    const sandbox = new SandboxApi(page.request, workPage.currentProjectId());
    const workbench = new WorkbenchPage(page);

    await sandbox.configureProject(
      undefined,
      120,
      SANDBOX_E2E_REPOSITORIES.deliveryProtectionChange,
      { mode: "commit_to_branch", targetBranch: "release/e2e" },
    );
    await workPage.reload();
    await workPage.openNewProjectConversation();
    await homePage.selectModel("GPT OSS 120B");
    await homePage.sendMessage("Polychat sandbox E2E: branch protection changes at approval.");
    await expect.poll(async () => (await sandbox.latestRun())?.runId).toBeTruthy();
    const run = await sandbox.latestRun();

    if (!run) {
      throw new Error("The branch protection run was not created");
    }

    await expect
      .poll(
        async () =>
          (await sandbox.instructions(run.runId)).some(
            ({ instruction }) => instruction.kind === "approval_request",
          ),
        { timeout: 60_000 },
      )
      .toBe(true);
    await workbench.resolveApproval("Approve");
    await expect
      .poll(async () => (await sandbox.latestRun())?.status, { timeout: 60_000 })
      .toBe("failed");
    const events = await sandbox.events(run.runId);
    const completed = await sandbox.latestRun();

    expect(events.some(({ event }) => event.type === "delivery_failed")).toBe(true);
    expect(events.some(({ event }) => event.type === "commit_push_started")).toBe(false);
    expect(completed?.manifest?.delivery.commit).toMatch(/^[a-f0-9]{40}$/);
    expect(completed?.manifest?.outcome).toMatchObject({
      error: expect.stringContaining("Direct delivery requires an existing non-protected branch"),
    });
  });

  test("does not commit after a failed quality gate and retains partial delivery evidence when pull request creation fails", async ({
    page,
    workPage,
    homePage,
  }) => {
    test.setTimeout(180_000);
    await workPage.openProjectFromWorkspace("Release Workspace", "Release Project");
    const sandbox = new SandboxApi(page.request, workPage.currentProjectId());

    await sandbox.configureProject(undefined, 120, SANDBOX_E2E_REPOSITORIES.delivery, {
      mode: "review_branch",
      destination: "pull_request",
    });
    await workPage.reload();
    await workPage.openNewProjectConversation();
    await homePage.selectModel("GPT OSS 120B");
    await homePage.sendMessageAndRequireCompletion(
      "Polychat sandbox E2E: fail validation before delivery.",
    );
    await expect
      .poll(async () => (await sandbox.latestRun())?.status, { timeout: 60_000 })
      .toBe("completed");
    const failedGateRun = await sandbox.latestRun();

    if (!failedGateRun) {
      throw new Error("The failed quality gate run was not retained");
    }

    const failedGateEvents = await sandbox.events(failedGateRun.runId);

    expect(failedGateRun.manifest?.validation.qualityGate).toBe("failed");
    expect(failedGateEvents.some(({ event }) => event.type === "commit_skipped")).toBe(true);
    expect(failedGateEvents.some(({ event }) => event.type === "commit_created")).toBe(false);
    expect(failedGateEvents.some(({ event }) => event.type === "delivery_started")).toBe(false);

    await sandbox.configureProject(
      undefined,
      120,
      SANDBOX_E2E_REPOSITORIES.deliveryPullRequestFailure,
      { mode: "review_branch", destination: "pull_request" },
    );
    await workPage.reload();
    await workPage.openNewProjectConversation();
    await homePage.sendMessage("Polychat sandbox E2E: fail only while opening the pull request.");
    await expect
      .poll(async () => (await sandbox.latestRun())?.runId, { timeout: 10_000 })
      .not.toBe(failedGateRun.runId);
    const pullRequestRun = await sandbox.latestRun();

    if (!pullRequestRun) {
      throw new Error("The partial pull request run was not created");
    }

    await expect
      .poll(
        async () =>
          (await sandbox.instructions(pullRequestRun.runId)).some(
            ({ instruction }) => instruction.kind === "approval_request",
          ),
        { timeout: 60_000 },
      )
      .toBe(true);
    const workbench = new WorkbenchPage(page);

    await workbench.resolveApproval("Approve");
    await expect
      .poll(async () => (await sandbox.latestRun())?.status, { timeout: 60_000 })
      .toBe("failed");
    const partial = await sandbox.latestRun();
    const partialEvents = await sandbox.events(pullRequestRun.runId);

    expect(partialEvents.some(({ event }) => event.type === "commit_pushed")).toBe(true);
    expect(partialEvents.some(({ event }) => event.type === "delivery_failed")).toBe(true);
    expect(partial?.manifest?.delivery.branch).toMatch(/^polychat\/run-/);
    expect(partial?.manifest?.delivery.commit).toMatch(/^[a-f0-9]{40}$/);
    expect(partial?.manifest?.delivery.pullRequestUrl).toBeUndefined();
    expect(partial?.manifest?.outcome).toMatchObject({
      error: expect.stringContaining("GitHub could not create the pull request"),
    });
  });

  test("honours custom local preparation without creating a commit or remote delivery", async ({
    page,
    workPage,
    homePage,
  }) => {
    test.setTimeout(90_000);
    await workPage.openProjectFromWorkspace("Release Workspace", "Release Project");
    const sandbox = new SandboxApi(page.request, workPage.currentProjectId());

    await sandbox.configureProject(undefined, 120, SANDBOX_E2E_REPOSITORIES.delivery, {
      mode: "custom",
      instructions: "Keep a local CUSTOM_LOCAL_PREPARATION marker and do not write remotely.",
    });
    await workPage.reload();
    await workPage.openNewProjectConversation();
    await homePage.selectModel("GPT OSS 120B");
    await homePage.sendMessageAndRequireCompletion(
      "Polychat sandbox E2E: apply the custom local preparation.",
    );
    await expect
      .poll(async () => (await sandbox.latestRun())?.status, { timeout: 60_000 })
      .toBe("completed");
    const run = await sandbox.latestRun();

    if (!run) {
      throw new Error("The custom delivery run was not retained");
    }

    const events = await sandbox.events(run.runId);

    expect(run.manifest?.delivery.policy).toEqual({
      mode: "custom",
      instructions: "Keep a local CUSTOM_LOCAL_PREPARATION marker and do not write remotely.",
    });
    expect(run.manifest?.delivery.branch).toBeUndefined();
    expect(run.manifest?.delivery.commit).toBeUndefined();
    expect(run.manifest?.delivery.pullRequestUrl).toBeUndefined();
    expect(events.some(({ event }) => event.type === "commit_created")).toBe(false);
    expect(events.some(({ event }) => event.type === "commit_push_started")).toBe(false);
    expect(events.some(({ event }) => event.type === "delivery_started")).toBe(false);
    expect(run.manifest?.changes.files).toContain("README.md");
  });

  test("fails dispatch after installation or repository authority is revoked and does not inherit an owner's authority", async ({
    page,
    browser,
    workPage,
    homePage,
  }) => {
    test.setTimeout(150_000);
    await workPage.openProjectFromWorkspace("Release Workspace", "Release Project");
    const projectUrl = page.url();
    const projectId = workPage.currentProjectId();
    const sandbox = new SandboxApi(page.request, projectId);

    await sandbox.configureProject(
      undefined,
      120,
      SANDBOX_E2E_REPOSITORIES.delivery,
      { mode: "leave_uncommitted" },
      987655,
    );
    await workPage.reload();
    await workPage.openNewProjectConversation();
    await homePage.selectModel("GPT OSS 120B");
    await homePage.sendMessage("Polychat sandbox E2E: revoked installation must fail.");
    await expect
      .poll(async () => (await sandbox.latestRun())?.status, { timeout: 30_000 })
      .toBe("failed");
    const revokedRun = await sandbox.latestRun();

    expect(revokedRun?.error).toContain("Installation revoked");
    expect(revokedRun?.manifest?.delivery.commit).toBeUndefined();

    await sandbox.configureProject(undefined, 120, SANDBOX_E2E_REPOSITORIES.delivery);
    await sandbox.replaceConnectionRepositories([]);
    await workPage.navigate(projectUrl);
    await workPage.openNewProjectConversation();
    await homePage.sendMessage("Polychat sandbox E2E: removed repository must fail.");
    await expect
      .poll(async () => (await sandbox.latestRun())?.runId, { timeout: 10_000 })
      .not.toBe(revokedRun?.runId);
    await expect
      .poll(async () => (await sandbox.latestRun())?.status, { timeout: 30_000 })
      .toBe("failed");
    const removedRun = await sandbox.latestRun();

    expect(removedRun?.error).toContain("does not allow this repository");
    expect(removedRun?.manifest?.delivery.commit).toBeUndefined();

    await workPage.navigate(projectUrl);
    await workPage.openProjectSurface("People");
    const member = await provisionPersonaBrowserContext(
      browser,
      "pro",
      `${test.info().testId}:member`,
    );

    try {
      const invitation = await workPage.createMemberInvitation(member.email);
      const memberTab = await member.context.newPage();
      const memberWork = new WorkPage(memberTab);
      const memberHome = new HomePage(memberTab);
      const memberSandbox = new SandboxApi(member.context.request, projectId);

      await memberWork.acceptInvitation(invitation);
      await memberWork.navigate(projectUrl);
      await memberWork.openNewProjectConversation();
      await memberHome.sendMessage("Polychat sandbox E2E: member cannot inherit runner authority.");
      await expect
        .poll(async () => (await memberSandbox.latestRun())?.runId, { timeout: 10_000 })
        .not.toBe(removedRun?.runId);
      await expect
        .poll(async () => (await memberSandbox.latestRun())?.status, { timeout: 30_000 })
        .toBe("failed");
      const memberRun = await memberSandbox.latestRun();

      expect(memberRun?.error).toContain("GitHub App connection not found for installation");
      expect(memberRun?.manifest?.delivery.commit).toBeUndefined();
    } finally {
      await member.context.close();
    }
  });
});
