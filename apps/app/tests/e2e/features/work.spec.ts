import { PolychatApi } from "../fixtures/polychat-api";
import { expect, provisionPersonaSession, test } from "../fixtures/polychat-test";
import { createSilentWavFixture } from "../fixtures/test-data";
import { WorkPage } from "../page-objects";
import { expectDropdownValue } from "../support/dropdown";
import { captureVisualSnapshots, DEFAULT_VISUAL_CHECKPOINTS } from "../support/visual-cloud";

test.describe("Work experience", () => {
  test.describe("logged out", () => {
    test.use({ persona: "logged-out" });

    test("offers sign-in from the Work overview and protected workspace routes", async ({
      homePage,
      page,
      workPage,
    }) => {
      await workPage.open();
      await expect(
        page.getByRole("heading", { name: "Bring your projects together." }),
      ).toBeVisible();
      await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
      await captureVisualSnapshots(page, "release-work-logged-out-overview", {
        ...DEFAULT_VISUAL_CHECKPOINTS,
        viewports: [{ name: "desktop", width: 1280, height: 720 }],
      });

      await homePage.navigate("/work/e2e-workspace-0");
      await expect(page.getByRole("heading", { name: "Sign in to continue" })).toBeVisible();
      await expect(
        page.getByText("Sign in to access this workspace and its projects."),
      ).toBeVisible();
      await captureVisualSnapshots(page, "release-work-logged-out-workspace-protection", {
        ...DEFAULT_VISUAL_CHECKPOINTS,
        viewports: [{ name: "desktop", width: 1280, height: 720 }],
        colorSchemes: ["light", "dark"],
      });

      await homePage.navigate("/work/e2e-workspace-0/projects/e2e-project-0");
      await expect(page.getByRole("heading", { name: "Sign in to continue" })).toBeVisible();
      await expect(
        page.getByText("Sign in to access this workspace and its projects."),
      ).toBeVisible();
      await captureVisualSnapshots(page, "release-work-logged-out-project-protection", {
        ...DEFAULT_VISUAL_CHECKPOINTS,
        viewports: [{ name: "desktop", width: 1280, height: 720 }],
        colorSchemes: ["light", "dark"],
      });

      await homePage.navigate(
        "/work/invitations?token=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      );
      await expect(
        page.getByRole("heading", { name: "Sign in to accept your invitation" }),
      ).toBeVisible();
      await captureVisualSnapshots(page, "release-work-logged-out-invitation", {
        ...DEFAULT_VISUAL_CHECKPOINTS,
        viewports: [{ name: "desktop", width: 1280, height: 720 }],
      });
    });
  });

  test.describe("free", () => {
    test.use({ persona: "free" });

    test("keeps Work behind the Pro entitlement and provides a return to Chat", async ({
      page,
      workPage,
    }) => {
      await workPage.open();
      await expect(page.getByRole("heading", { name: "Unlock shared workspaces." })).toBeVisible();
      await expect(page.getByRole("link", { name: "Upgrade to Pro" })).toBeVisible();
      await captureVisualSnapshots(page, "release-work-free-protection", {
        ...DEFAULT_VISUAL_CHECKPOINTS,
        viewports: [{ name: "desktop", width: 1280, height: 720 }],
      });
      await workPage.returnToChat();
      await expect(page).toHaveURL(/\/chat$/);
      await expect(page.getByRole("textbox", { name: "Message input" })).toBeEditable();
    });
  });

  test.describe("pro", () => {
    test.use({ persona: "pro" });

    test("offers the complete project and personal capability authoring menus by keyboard", async ({
      capabilitiesPage,
      page,
      workPage,
    }) => {
      await workPage.openProjectFromWorkspace("Release Workspace", "Release Project");
      await workPage.openProjectSurface("Teammates & tools");
      await capabilitiesPage.openAddMenuWithKeyboard();

      await expect(capabilitiesPage.addMenuItem("Hire a teammate")).toContainText(
        "Start from a role, or describe the job in your own words",
      );
      await expect(capabilitiesPage.addMenuItem("Build one from scratch")).toContainText(
        "Configure a brief, its model, tools and skills yourself",
      );
      await expect(capabilitiesPage.addMenuItem("Attach a teammate")).toContainText(
        "Bring in a teammate this workspace already owns",
      );
      await expect(capabilitiesPage.addMenuItem("Add a skill")).toContainText(
        "Upload an Teammate Skills document",
      );
      await expect(capabilitiesPage.addMenuItem("Browse shared teammates")).toHaveCount(0);
      await expect(capabilitiesPage.addMenuItem("Hire a teammate")).toBeFocused();

      await capabilitiesPage.moveAddMenuSelection();
      await expect(capabilitiesPage.addMenuItem("Build one from scratch")).toBeFocused();
      await capabilitiesPage.moveAddMenuSelection();
      await expect(capabilitiesPage.addMenuItem("Attach a teammate")).toBeFocused();
      await capabilitiesPage.moveAddMenuSelection();
      await expect(capabilitiesPage.addMenuItem("Add a skill")).toBeFocused();
      await capabilitiesPage.selectAddMenuItemWithKeyboard();
      await expect(page.getByRole("dialog", { name: "Add skill" })).toBeVisible();
      await capabilitiesPage.dismissDialog();

      await capabilitiesPage.open();
      await capabilitiesPage.openAddMenuWithKeyboard();
      await expect(capabilitiesPage.addMenuItem("Browse shared teammates")).toContainText(
        "Install a teammate someone has published",
      );
      await expect(capabilitiesPage.addMenuItem("Attach a teammate")).toHaveCount(0);
      await capabilitiesPage.closeAddMenuWithKeyboard();
      await expect(capabilitiesPage.addMenu).toBeFocused();
    });

    test("revises, promotes, rolls back and archives a project skill", async ({
      polychatApi,
      workPage,
    }) => {
      await workPage.openProjectFromWorkspace("Release Workspace", "Release Project");
      const projectId = workPage.currentProjectId();
      const result = await polychatApi.exerciseProjectSkillRevisionLifecycle(projectId, {
        name: "project-release-skill",
        initialInstructions: "Answer with the stable project procedure.",
        revisedInstructions: "Answer with the revised project procedure.",
        resourceContent: "Project evidence belongs to the project scope.",
      });

      expect(result.draft.revision.revision).toBeGreaterThan(result.initialRevision.revision);
      expect(result.promoted.state.stableRevisionId).toBe(result.draft.revision.id);
      expect(result.rolledBack.revision.revision).toBeGreaterThan(
        result.promoted.revision.revision,
      );
      expect(result.rolledBack.content).toContain("stable project procedure");
      expect(result.retrieved.resources).toEqual([
        {
          path: "references/evidence.md",
          content: "Project evidence belongs to the project scope.",
        },
      ]);
      expect(result.archivedStatus).toBe(404);
      expect(result.recreated.scope).toEqual({ type: "project", projectId });
    });

    test("navigates workspace, people, governance and every project surface", async ({
      page,
      workPage,
    }) => {
      test.slow();

      await workPage.open();
      await expect(page.getByText("1 projects")).toBeVisible();
      await workPage.openWorkspace("Release Workspace");
      await expect(page.getByText("Release validation workspace")).toBeVisible();
      await captureVisualSnapshots(page, "release-work-open-workspace", {
        ...DEFAULT_VISUAL_CHECKPOINTS,
        viewports: [{ name: "desktop", width: 1280, height: 720 }],
      });

      await workPage.openProjectSurface("People");
      await expect(
        page.getByRole("main").getByText("Pro Release User", { exact: true }),
      ).toBeVisible();
      await captureVisualSnapshots(page, "release-work-surface-people", {
        ...DEFAULT_VISUAL_CHECKPOINTS,
        viewports: [{ name: "desktop", width: 1280, height: 720 }],
        colorSchemes: ["light", "dark"],
      });
      await workPage.openProjectSurface("Governance");
      await captureVisualSnapshots(page, "release-work-surface-governance", {
        ...DEFAULT_VISUAL_CHECKPOINTS,
        viewports: [{ name: "desktop", width: 1280, height: 720 }],
        colorSchemes: ["light", "dark"],
      });

      await workPage.openWorkspaceProjects("Release Workspace");
      await workPage.openProject("Release Project");
      await expect(page.getByText("Release validation project")).toBeVisible();
      await captureVisualSnapshots(page, "release-work-project-overview", {
        ...DEFAULT_VISUAL_CHECKPOINTS,
        viewports: [
          { name: "desktop", width: 1280, height: 720 },
          { name: "mobile", width: 390, height: 844 },
        ],
      });

      for (const surface of ["Files", "Activity", "Teammates & tools"] as const) {
        await test.step(surface, async () => {
          await workPage.openProjectSurface(surface);
          await captureVisualSnapshots(
            page,
            `release-work-project-surface-${surface.toLowerCase()}`,
            {
              ...DEFAULT_VISUAL_CHECKPOINTS,
              viewports: [{ name: "desktop", width: 1280, height: 720 }],
              colorSchemes: ["light", "dark"],
            },
          );
        });
      }
    });

    test("finds projects and capabilities through global search", async ({
      homePage,
      page,
      workPage,
    }) => {
      await page.emulateMedia({ colorScheme: "dark" });
      await workPage.open();
      await expect(page.locator("html")).toHaveClass(/dark/);
      await homePage.searchPolychat("Release Project");
      const projectResult = page.getByRole("option").filter({ hasText: "Release Project" });

      await expect(projectResult).toBeVisible();
      await projectResult.click();
      await expect(page.getByText("Release validation project")).toBeVisible();

      await homePage.searchPolychat("Note Taker");
      await expect(page.getByRole("option").filter({ hasText: "Note Taker" })).toBeVisible();

      await homePage.searchPolychat("e");
      const resultList = page.getByRole("listbox");
      const results = resultList.getByRole("option");

      await expect.poll(() => results.count()).toBeGreaterThan(8);
      for (let index = 0; index < 30; index += 1) {
        await page.keyboard.press("ArrowDown");
      }

      const selectedResult = resultList.locator('[role="option"][aria-selected="true"]');

      await expect(selectedResult).toBeInViewport();
      await homePage.closeGlobalSearch();
    });

    test("sends a project conversation using its Work context", async ({
      homePage,
      page,
      workPage,
    }) => {
      await workPage.open();
      await workPage.openWorkspace("Release Workspace");
      await workPage.openProject("Release Project");
      await workPage.openNewProjectConversation();
      await homePage.selectModel("GPT OSS 120B");
      await homePage.uploadFile({
        name: "release-work-context.md",
        mimeType: "text/markdown",
        buffer: Buffer.from("# Work release context\n\nUse this document in the project response."),
      });
      await homePage.sendMessage("Use the project instructions for this Work conversation");
      await homePage.waitForChatResponse(0);
      await expect(homePage.getLatestAssistantMessage()).toContainText("E2E response:");
      await homePage.hoverConversation(/Use the project instructions|Release validation chat/);
      await workPage.openProjectFiles("Given");
      await expect(page.getByText("release-work-context.md", { exact: true })).toBeVisible();
      await captureVisualSnapshots(page, "release-work-project-conversation", {
        ...DEFAULT_VISUAL_CHECKPOINTS,
        colorSchemes: ["light", "dark"],
      });
    });

    test("recovers an interrupted project run after a refresh and reopens it from the sidebar", async ({
      homePage,
      page,
      workPage,
    }) => {
      await workPage.openProjectFromWorkspace("Release Workspace", "Release Project");
      const workspaceId = workPage.currentWorkspaceId();
      const projectId = workPage.currentProjectId();

      await workPage.openNewProjectConversation();
      await homePage.selectModel("GPT OSS 120B");
      const request = await homePage.sendMessageAndRequireCompletion(
        "Recover this interrupted stream inside the project conversation",
      );
      const conversationId = homePage.completionIdFromRequest(request);
      const conversationPath = `/work/${workspaceId}/projects/${projectId}/chat/${conversationId}`;

      await expect(homePage.getLatestAssistantMessage()).toContainText("recovery data so far");
      await page.waitForURL(`**${conversationPath}`);
      await page.reload();

      expect(new URL(page.url()).pathname).toBe(conversationPath);
      await expect(homePage.getLatestUserMessage()).toContainText(
        "inside the project conversation",
      );
      await expect(homePage.stopResponseButton).toBeVisible();
      await expect(homePage.getLatestAssistantMessage()).toContainText(
        "the interrupted stream completed",
        { timeout: 20_000 },
      );
      await expect(homePage.stopResponseButton).toBeHidden();
      await expect(homePage.chatInput).toBeEditable();

      await workPage.navigate(`/work/${workspaceId}/projects/${projectId}`);
      await homePage.openConversation(/Recover this interrupted stream|Release validation chat/);

      expect(new URL(page.url()).pathname).toBe(conversationPath);
      await homePage.reload();

      expect(new URL(page.url()).pathname).toBe(conversationPath);
      await expect(homePage.getLatestUserMessage()).toContainText(
        "inside the project conversation",
      );
      await expect(homePage.getLatestAssistantMessage()).toContainText(
        "the interrupted stream completed",
      );
    });

    test("separates task notification registration from the browser permission", async ({
      context,
      page,
      workPage,
    }) => {
      await context.grantPermissions(["notifications"]);
      await workPage.open();
      const notifications = page
        .getByRole("heading", { name: "Task notifications", exact: true })
        .locator("xpath=ancestor::div[1]");

      await expect(notifications).toContainText(
        "Allow browser notifications to hear about task changes when Polychat is closed.",
      );
      await expect(
        page.getByRole("switch", { name: "Task notifications", exact: true }),
      ).not.toBeChecked();
      await expect(
        page.getByRole("switch", { name: "Decisions and approvals", exact: true }),
      ).toBeDisabled();
      await expect(
        page.getByRole("button", { name: "Retry registration", exact: true }),
      ).toHaveCount(0);
    });

    test("offers Fast processing inside a Work conversation", async ({ homePage, workPage }) => {
      await workPage.openProjectFromWorkspace("Release Workspace", "Release Project");
      const projectId = workPage.currentProjectId();

      await workPage.openNewProjectConversation();
      await homePage.selectModel("GPT-6 Astra");
      const settings = await homePage.openChatSettings();

      await expect(settings.getByLabel("Processing", { exact: true })).toHaveValue("auto");
      await expect(settings).toContainText("Fast (2×)");
      await settings.getByRole("button", { name: "Done", exact: true }).click();
      await homePage.configureProcessingTier("fast");
      const request = await homePage.sendMessageAndRequireCompletion(
        "Use Fast processing in this Work conversation",
      );

      expect(request).toMatchObject({
        service_tier: "fast",
        metadata: { project_id: projectId },
      });
      await homePage.waitForChatResponse(0);
      await expect(homePage.getLatestAssistantMessage()).toContainText("E2E response:");
    });

    test("follows the saved project tier while explicit tiers and models remain authoritative", async ({
      homePage,
      polychatApi,
      workPage,
    }) => {
      await workPage.openProjectFromWorkspace("Release Workspace", "Release Project");
      const projectId = workPage.currentProjectId();

      await workPage.setProjectRoutingPreference("low");
      await workPage.openNewProjectConversation();
      await homePage.selectModelTier("Default");
      const inherited = await homePage.sendMessageAndRequireCompletion(
        "Use the saved project default tier",
      );

      expect(inherited.model_tier).toBeUndefined();
      expect(inherited.model).toBeUndefined();
      expect(inherited.metadata).toMatchObject({ project_id: projectId });
      await homePage.waitForChatResponse(0);

      await homePage.selectModelTier("High");
      const explicitTier = await homePage.sendMessageAndRequireCompletion(
        "Override the saved project tier with High",
      );

      expect(explicitTier.model_tier).toBe("high");
      await homePage.waitForChatResponse(1);

      await homePage.selectModel("GPT-5.5");
      const explicitModel = await homePage.sendMessageAndRequireCompletion(
        "Override the saved project tier with a named model",
      );

      expect(explicitModel.model).toBe("gpt-5.5");
      expect(explicitModel.model_tier).toBeUndefined();
      await homePage.waitForChatResponse(2);

      await homePage.navigate("/chat");
      await homePage.selectModelTier("Default");
      const personalAutomatic = await homePage.sendMessageAndRequireCompletion(
        "Keep the personal default tier outside Work",
      );

      expect(personalAutomatic.model_tier).toBeUndefined();
      expect(personalAutomatic.metadata).toBeUndefined();
      await homePage.waitForChatResponse(0);
      expect(
        await polychatApi.completionStatus({
          ...personalAutomatic,
          metadata: { project_id: projectId },
        }),
      ).toBe(409);
    });

    test("isolates workspace usage and presents current and empty periods", async ({
      billingState,
      homePage,
      page,
      polychatApi,
      workPage,
    }) => {
      await workPage.openProjectFromWorkspace("Release Workspace", "Release Project");
      const releaseProjectId = workPage.currentProjectId();
      const releaseWorkspaceId = workPage.currentWorkspaceId();

      await workPage.openNewProjectConversation();
      await homePage.selectModel("GPT OSS 120B");
      await homePage.sendMessage("Record usage in the release workspace");
      await homePage.waitForChatResponse(0);
      await expect
        .poll(async () =>
          (await polychatApi.getAccountUsageEvents({ limit: 100 })).events.some(
            ({ project_id, workspace_id }) =>
              project_id === releaseProjectId && workspace_id === releaseWorkspaceId,
          ),
        )
        .toBe(true);

      await homePage.navigate("/chat");
      await homePage.selectModel("GPT OSS 120B");
      await homePage.sendMessage("Record personal usage outside Work");
      await homePage.waitForChatResponse(0);

      await workPage.open();
      await workPage.createWorkspace(
        "Usage Isolation Workspace",
        "Proves workspace usage does not cross scopes.",
      );
      const isolatedWorkspaceId = workPage.currentWorkspaceId();

      await workPage.createProject(
        "Usage Isolation Project",
        "Records an independent workspace event.",
        "Use concise answers.",
      );
      const isolatedProjectId = workPage.currentProjectId();

      await workPage.openNewProjectConversation();
      await homePage.selectModel("GPT OSS 120B");
      await homePage.sendMessage("Record usage in the isolated workspace");
      await homePage.waitForChatResponse(0);

      await billingState.set({
        spentCredits: 6,
        ledger: [
          {
            source: "model",
            vendor: "openai",
            resource: "gpt-5.6",
            unit: "input_tokens",
            quantity: 10_000,
            costMicros: 100_000,
            credits: 0,
            byok: true,
            projectId: releaseProjectId,
            workspaceId: releaseWorkspaceId,
          },
          {
            source: "infrastructure",
            vendor: "cloudflare",
            resource: "worker-request",
            unit: "requests",
            quantity: 2,
            costMicros: 60_000,
            credits: 2,
            projectId: releaseProjectId,
            workspaceId: releaseWorkspaceId,
          },
          {
            source: "model",
            vendor: "cerebras",
            resource: "gpt-oss-120b",
            unit: "input_tokens",
            quantity: 12_000,
            costMicros: 80_000,
            credits: 3,
            projectId: isolatedProjectId,
            workspaceId: isolatedWorkspaceId,
          },
          {
            source: "model",
            vendor: "cerebras",
            resource: "personal-gpt-oss-120b",
            unit: "input_tokens",
            quantity: 4_000,
            costMicros: 20_000,
            credits: 1,
          },
        ],
      });

      await expect
        .poll(
          async () => (await polychatApi.getWorkspaceUsage(releaseWorkspaceId)).totals.event_count,
        )
        .toBeGreaterThan(0);
      await expect
        .poll(
          async () => (await polychatApi.getWorkspaceUsage(isolatedWorkspaceId)).totals.event_count,
        )
        .toBeGreaterThan(0);
      const releaseUsage = await polychatApi.getWorkspaceUsage(releaseWorkspaceId);
      const isolatedUsage = await polychatApi.getWorkspaceUsage(isolatedWorkspaceId);
      const accountUsage = await polychatApi.getAccountUsageSummary();

      expect(releaseUsage.by_project.map(({ key }) => key)).toEqual([releaseProjectId]);
      expect(isolatedUsage.by_project.map(({ key }) => key)).toEqual([isolatedProjectId]);
      expect(releaseUsage.totals).toMatchObject({
        cost_micros: 160_000,
        credit_micros: 2_000_000,
        event_count: 2,
      });
      expect(releaseUsage.by_source).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ key: "model", cost_micros: 100_000, credit_micros: 0 }),
          expect.objectContaining({
            key: "infrastructure",
            cost_micros: 60_000,
            credit_micros: 2_000_000,
          }),
        ]),
      );
      expect(accountUsage.totals.event_count).toBeGreaterThan(releaseUsage.totals.event_count);
      expect(accountUsage.totals.event_count).toBeGreaterThan(isolatedUsage.totals.event_count);

      await workPage.navigate(`/work/${releaseWorkspaceId}/governance`);
      const usageSection = page
        .getByRole("heading", { name: "Workspace usage" })
        .locator("xpath=ancestor::section[1]");

      await expect(usageSection).toBeVisible();
      await expect(page.getByRole("heading", { name: "By source" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "By vendor" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "By project" })).toBeVisible();
      await expect(usageSection.getByText("Release Project", { exact: true })).toBeVisible();

      const month = page.getByLabel("Month (UTC)", { exact: true });

      await month.fill("2000-01");
      await expect(
        page.getByText("Nothing spent yet this period.", { exact: false }),
      ).toBeVisible();
      await expect(usageSection).not.toContainText(/allowance|balance/i);
      await month.fill(new Date().toISOString().slice(0, 7));
      await expect(page.getByRole("heading", { name: "By project" })).toBeVisible();
      await page.getByRole("button", { name: "Refresh" }).click();
      await expect(usageSection.getByText("Release Project", { exact: true })).toBeVisible();

      await workPage.navigate(`/work/${isolatedWorkspaceId}`);
      await workPage.deleteWorkspace();
    });

    test("updates project configuration and manages workspace invitations", async ({
      page,
      workPage,
    }) => {
      await workPage.openProjectFromWorkspace("Release Workspace", "Release Project");
      await workPage.updateProjectBrief("Use concise answers and cite the release context.");
      await expect(
        page.getByText("Use concise answers and cite the release context.", { exact: true }),
      ).toBeVisible();
      await workPage.setProjectRoutingPreference("low");
      await workPage.reload();
      await expectDropdownValue(workPage.projectRoutingPreference(), /^Low —/);
      await workPage.setProjectRoutingPreference("");
      await workPage.reload();
      await expectDropdownValue(
        workPage.projectRoutingPreference(),
        "Medium — the account default",
      );
      await captureVisualSnapshots(page, "release-work-project-config", {
        ...DEFAULT_VISUAL_CHECKPOINTS,
        viewports: [{ name: "desktop", width: 1280, height: 720 }],
      });

      await workPage.openProjectSurface("People");
      await workPage.inviteAndRevokeMember("release-teammate@polychat.invalid");
      await expect(
        page.getByText("release-teammate@polychat.invalid", { exact: true }),
      ).toHaveCount(0);
    });

    test(
      "accepts an invitation and manages the resulting workspace member",
      { tag: "@release" },
      async ({ page, browser, homePage, polychatApi, workPage }, testInfo) => {
        const invitee = await provisionPersonaSession(
          "pro",
          `${testInfo.testId}:invitee:${testInfo.retry}`,
        );

        await workPage.openProjectFromWorkspace("Release Workspace", "Release Project");
        const projectId = workPage.currentProjectId();
        const workspaceId = workPage.currentWorkspaceId();
        const projectPath = new URL(page.url()).pathname;
        const projectSettingsPath = `${projectPath}/settings`;

        await workPage.openNewProjectConversation();
        await homePage.selectModel("GPT OSS 120B");
        const conversationRequest = await homePage.sendMessageAndRequireCompletion(
          "A project reply saved only by its owner",
        );

        await homePage.waitForChatResponse(0);
        const conversationId = homePage.completionIdFromRequest(conversationRequest);
        const messageId = await homePage.getLatestAssistantMessage().getAttribute("data-id");

        if (!messageId) {
          throw new Error("Project reply has no message id");
        }

        expect(await polychatApi.saveMessageStatus(conversationId, messageId)).toBe(200);
        await workPage.navigate(projectPath);

        await workPage.setProjectRoutingPreference("low");
        const memberSkill = await polychatApi.createProjectSkill(
          projectId,
          "member-visible-skill",
          "Use the stable member-visible instructions.",
        );
        const memberSkillHistory = await polychatApi.getProjectSkillHistory(
          projectId,
          memberSkill.name,
        );
        const memberSkillRevision = memberSkillHistory.revisions.at(-1);

        if (!memberSkillRevision) {
          throw new Error("Created project skill has no initial revision");
        }

        await workPage.openProjectSurface("People");
        const inviteUrl = await workPage.createMemberInvitation(invitee.email);

        const inviteeContext = await browser.newContext();
        const outsider = await provisionPersonaSession(
          "pro",
          `${testInfo.testId}:outsider:${testInfo.retry}`,
        );
        const outsiderContext = await browser.newContext();

        try {
          await inviteeContext.addCookies([
            {
              name: "session",
              value: invitee.sessionToken,
              domain: "localhost",
              path: "/",
              httpOnly: true,
              sameSite: "Lax",
              secure: false,
            },
          ]);
          await outsiderContext.addCookies([
            {
              name: "session",
              value: outsider.sessionToken,
              domain: "localhost",
              path: "/",
              httpOnly: true,
              sameSite: "Lax",
              secure: false,
            },
          ]);
          const inviteeWorkPage = new WorkPage(await inviteeContext.newPage());

          await inviteeWorkPage.acceptInvitation(inviteUrl);
          await inviteeWorkPage.navigate(projectSettingsPath);
          await expectDropdownValue(inviteeWorkPage.projectRoutingPreference(), /^Low —/);
          await expect(inviteeWorkPage.projectRoutingPreference()).toBeDisabled();
          await expect(
            inviteeWorkPage.page.getByRole("button", { name: "More project actions" }),
          ).toHaveCount(0);
          const inviteeApi = new PolychatApi(inviteeContext.request);

          expect((await inviteeApi.listSavedMessages()).messages).toHaveLength(0);
          expect(await inviteeApi.conversationStatus(conversationId)).toBe(200);
          expect(await inviteeApi.instantiateStarterStatus(workspaceId)).toBe(403);
          expect(
            await new PolychatApi(outsiderContext.request).conversationThreadsStatus(
              conversationId,
            ),
          ).toBe(404);
          await inviteeWorkPage.navigate(`/work/${workspaceId}/governance`);
          await expect(
            inviteeWorkPage.page.getByRole("button", { name: /^Start Build an internal tool$/ }),
          ).toHaveCount(0);
          const visibleSkill = await inviteeApi.getProjectSkill(projectId, memberSkill.name);

          expect(visibleSkill.content).toContain("stable member-visible instructions");
          expect(await inviteeApi.projectSkillHistoryStatus(projectId, memberSkill.name)).toBe(403);
          expect(
            await inviteeApi.projectSkillRevisionStatus(
              projectId,
              memberSkill.name,
              memberSkillRevision.id,
            ),
          ).toBe(403);
          expect(await inviteeApi.projectUpdateStatus(projectId, "ultra")).toBe(403);
          expect(await inviteeApi.workspaceUsageStatus(workspaceId)).toBe(403);
          expect(
            await new PolychatApi(outsiderContext.request).projectUpdateStatus(projectId, "ultra"),
          ).toBe(404);
          expect(
            await new PolychatApi(outsiderContext.request).workspaceUsageStatus(workspaceId),
          ).toBe(404);
          expect(await polychatApi.projectUpdateStatus(projectId, "unsupported")).toBe(400);
        } finally {
          await inviteeContext.close();
          await outsiderContext.close();
        }

        await workPage.promoteAndRemoveMember(invitee.email);
        await workPage.navigate(projectSettingsPath);
        await expectDropdownValue(workPage.projectRoutingPreference(), /^Low —/);
        await polychatApi.deleteProjectSkill(projectId, memberSkill.name);
        await captureVisualSnapshots(page, "release-work-invitee-cycle", {
          ...DEFAULT_VISUAL_CHECKPOINTS,
          viewports: [{ name: "desktop", width: 1280, height: 720 }],
        });
      },
    );

    test("saves, uses and deletes a governed project template", async ({ page, workPage }) => {
      await workPage.open();
      await workPage.openWorkspace("Release Workspace");
      await workPage.createProject(
        "Release template project",
        "Validates governed templates.",
        "Use the saved template instructions.",
      );
      await workPage.setProjectRoutingPreference("low");
      expect(await workPage.saveUseAndDeleteProjectTemplate("Release template project")).toBe(
        "low",
      );
      await expect(
        page.getByRole("heading", { name: "Release template project", exact: true }),
      ).toHaveCount(0);
      await captureVisualSnapshots(page, "release-work-template-lifecycle", {
        ...DEFAULT_VISUAL_CHECKPOINTS,
        viewports: [{ name: "desktop", width: 1280, height: 720 }],
      });
    });

    test("configures a project MCP tool", async ({ page, workPage }) => {
      await workPage.openProjectFromWorkspace("Release Workspace", "Release Project");
      await workPage.configureMcpTool("Release MCP", "https://mcp.polychat.invalid/sse");
      await captureVisualSnapshots(page, "release-work-mcp-config", {
        ...DEFAULT_VISUAL_CHECKPOINTS,
        viewports: [{ name: "desktop", width: 1280, height: 720 }],
      });
    });

    test("configures project file search", async ({ page, workPage }) => {
      await workPage.openProjectFromWorkspace("Release Workspace", "Release Project");
      await workPage.configureFileSearchTool(["vs_release_primary", "vs_release_archive"]);
      await captureVisualSnapshots(page, "release-work-file-search-config", {
        ...DEFAULT_VISUAL_CHECKPOINTS,
        viewports: [{ name: "desktop", width: 1280, height: 720 }],
      });
    });

    test("configures and manages a scheduled project recipe", async ({ workPage }) => {
      await workPage.openProjectFromWorkspace("Release Workspace", "Release Project");
      await workPage.configureScheduleAndRemoveDailyWeatherRecipe();
      await expect(workPage.getCapabilityAddButton("Daily Weather")).toBeVisible();
    });

    test("reflects project capability changes immediately", async ({ workPage }) => {
      await workPage.openProjectFromWorkspace("Release Workspace", "Release Project");
      await workPage.enableCapability("Note Taker");
      await workPage.removeCapability("Note Taker");
    });

    test("enables and completes a rich note experience", async ({ workPage }) => {
      await workPage.openProjectFromWorkspace("Release Workspace", "Release Project");
      await workPage.enableCapabilityAfterReload("Note Taker");
      await workPage.createUpdateAndDeleteProjectNote(
        "Release validation note",
        "This note exercises the project experience lifecycle.",
      );
      await workPage.removeCapabilityAfterReload("Note Taker");
      await expect(workPage.getCapabilityAddButton("Note Taker")).toBeVisible();
    });

    test("enables and completes a Strudel pattern experience", async ({ workPage }) => {
      await workPage.openProjectFromWorkspace("Release Workspace", "Release Project");
      await workPage.enableCapabilityAfterReload("Strudel Music Patterns");
      await workPage.createUpdateAndDeleteStrudelPattern(
        "Release validation rhythm",
        "A deterministic pattern for release validation.",
      );
      await workPage.removeCapabilityAfterReload("Strudel Music Patterns");
      await expect(workPage.getCapabilityAddButton("Strudel Music Patterns")).toBeVisible();
    });

    test("enables and generates an article report", async ({ page, workPage }) => {
      await workPage.openProjectFromWorkspace("Release Workspace", "Release Project");
      await workPage.enableCapabilityAfterReload("Article Processor");
      await workPage.createArticleReportFromPastedContent(
        "Polychat release validation checks user journeys against deterministic external services.",
      );
      await expect(page.getByText(/E2E response:/).first()).toBeVisible();
      await workPage.removeCapabilityAfterReload("Article Processor");
      await expect(workPage.getCapabilityAddButton("Article Processor")).toBeVisible();
    });

    test("enables and uploads a recording project asset", async ({ workPage }) => {
      await workPage.openProjectFromWorkspace("Release Workspace", "Release Project");
      await workPage.enableCapabilityAfterReload("Recording Processor");
      await workPage.uploadRecordingWithoutOptionalProcessing(
        "Release validation recording",
        "Deterministic recording project asset.",
        createSilentWavFixture(),
      );
      await workPage.removeCapabilityAfterReload("Recording Processor");
      await expect(workPage.getCapabilityAddButton("Recording Processor")).toBeVisible();
    });

    test("enables and browses Replicate models and predictions", async ({ page, workPage }) => {
      await workPage.openProjectFromWorkspace("Release Workspace", "Release Project");
      await workPage.enableCapabilityAfterReload("Replicate Predictions");
      await workPage.browseReplicateModelsAndPredictions("SDXL Lightning 4-Step");
      await expect(page.getByPlaceholder("Search Replicate models...")).toBeVisible();
      await workPage.removeCapabilityAfterReload("Replicate Predictions");
      await expect(workPage.getCapabilityAddButton("Replicate Predictions")).toBeVisible();
    });

    test("keeps a personal-only app out of a project and refuses it with its reason", async ({
      page,
      polychatApi,
      workPage,
    }) => {
      await workPage.openProjectFromWorkspace("Release Workspace", "Release Project");
      const projectId = workPage.currentProjectId();

      await workPage.searchProjectCapabilities("Training");
      await expect(page.getByRole("heading", { name: "Training", exact: true })).toHaveCount(0);

      const refusal = await polychatApi.addProjectCapability(
        projectId,
        "app",
        "featured-finetuning",
      );

      expect(refusal.status).toBe(400);
      expect(refusal.body).toContain("your own provider credentials");

      await workPage.searchProjectCapabilities("Note Taker");
      await expect(workPage.getCapabilityAddButton("Note Taker")).toBeVisible();
    });

    test("runs a dynamic project app and reviews its saved response", async ({
      externalServices,
      page,
      workPage,
    }) => {
      const payload = "https://polychat.example/release-validation";

      await externalServices.mockQrImage();
      await workPage.openProjectFromWorkspace("Release Workspace", "Release Project");
      await workPage.enableCapabilityAfterReload("Create Qr Code");
      await workPage.executeQrToolAndOpenSavedOutput(payload);
      await expect(page.getByRole("link", { name: "Download Generated Image" })).toHaveAttribute(
        "href",
        new RegExp(encodeURIComponent(payload)),
      );
      await workPage.removeCapabilityAfterReload("Create Qr Code");
      await expect(workPage.getCapabilityAddButton("Create Qr Code")).toBeVisible();
    });

    test("reviews activity and shares then revokes a project output", async ({
      page,
      workPage,
    }) => {
      await workPage.openProjectFromWorkspace("Release Workspace", "Release Project");
      await workPage.openActivity();
      await expect(
        page.getByText("Release validation run completed", { exact: true }),
      ).toBeVisible();
      await workPage.shareAndRevokeOutput("Release validation output");
      await expect(page.getByRole("button", { name: "Share", exact: true })).toBeVisible();
    });

    test(
      "creates and removes a workspace and project",
      { tag: "@release" },
      async ({ page, workPage }) => {
        await workPage.open();
        await workPage.createWorkspace(
          "Release lifecycle workspace",
          "Temporary release workspace",
        );
        await workPage.createProject(
          "Release lifecycle project",
          "Temporary release project",
          "Keep release answers concise.",
        );
        await workPage.archiveProject();
        await expect(
          page.getByRole("heading", { name: "Release lifecycle workspace" }),
        ).toBeVisible();
        await workPage.deleteWorkspace();
        await expect(page).toHaveURL(/\/work$/);
        await expect(page.getByText("Release lifecycle workspace", { exact: true })).toHaveCount(0);
      },
    );
  });
});
