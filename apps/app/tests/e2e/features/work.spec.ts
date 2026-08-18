import { expect, provisionPersonaSession, test } from "../fixtures/polychat-test";
import { createSilentWavFixture } from "../fixtures/test-data";
import { WorkPage } from "../page-objects";
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

    test("navigates workspace, people, governance and every project surface", async ({
      page,
      workPage,
    }) => {
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

      for (const surface of [
        "Experiences",
        "Outputs",
        "Sources",
        "Activity",
        "Capabilities",
      ] as const) {
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
      await homePage.selectModel("Compound Mini");
      await homePage.uploadFile({
        name: "release-work-context.md",
        mimeType: "text/markdown",
        buffer: Buffer.from("# Work release context\n\nUse this document in the project response."),
      });
      await homePage.sendMessage("Use the project instructions for this Work conversation");
      await homePage.waitForChatResponse(0);
      await expect(homePage.getLatestAssistantMessage()).toContainText("E2E response:");
      await workPage.openProjectSurface("Sources");
      await expect(page.getByText("release-work-context.md", { exact: true })).toBeVisible();
      await captureVisualSnapshots(page, "release-work-project-conversation", {
        ...DEFAULT_VISUAL_CHECKPOINTS,
        colorSchemes: ["light", "dark"],
      });
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

    test("accepts an invitation and manages the resulting workspace member", async ({
      page,
      browser,
      workPage,
    }, testInfo) => {
      const invitee = await provisionPersonaSession(
        "pro",
        `${testInfo.testId}:invitee:${testInfo.retry}`,
      );
      await workPage.openProjectFromWorkspace("Release Workspace", "Release Project");
      await workPage.openProjectSurface("People");
      const inviteUrl = await workPage.createMemberInvitation(invitee.email);

      const inviteeContext = await browser.newContext();
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
        const inviteeWorkPage = new WorkPage(await inviteeContext.newPage());
        await inviteeWorkPage.acceptInvitation(inviteUrl);
      } finally {
        await inviteeContext.close();
      }

      await workPage.promoteAndRemoveMember(invitee.email);
      await captureVisualSnapshots(page, "release-work-invitee-cycle", {
        ...DEFAULT_VISUAL_CHECKPOINTS,
        viewports: [{ name: "desktop", width: 1280, height: 720 }],
      });
    });

    test("saves, uses and deletes a governed project template", async ({ page, workPage }) => {
      await workPage.open();
      await workPage.openWorkspace("Release Workspace");
      await workPage.createProject(
        "Release template project",
        "Validates governed templates.",
        "Use the saved template instructions.",
      );
      await workPage.saveUseAndDeleteProjectTemplate("Release template project");
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

    test("enables and uploads a podcast project asset", async ({ workPage }) => {
      await workPage.openProjectFromWorkspace("Release Workspace", "Release Project");
      await workPage.enableCapabilityAfterReload("Podcast Processor");
      await workPage.uploadPodcastWithoutOptionalProcessing(
        "Release validation podcast",
        "Deterministic podcast project asset.",
        createSilentWavFixture(),
      );
      await workPage.removeCapabilityAfterReload("Podcast Processor");
      await expect(workPage.getCapabilityAddButton("Podcast Processor")).toBeVisible();
    });

    test("enables and browses Replicate models and predictions", async ({ page, workPage }) => {
      await workPage.openProjectFromWorkspace("Release Workspace", "Release Project");
      await workPage.enableCapabilityAfterReload("Replicate Predictions");
      await workPage.browseReplicateModelsAndPredictions("SDXL Lightning 4-Step");
      await expect(page.getByPlaceholder("Search Replicate models...")).toBeVisible();
      await workPage.removeCapabilityAfterReload("Replicate Predictions");
      await expect(workPage.getCapabilityAddButton("Replicate Predictions")).toBeVisible();
    });

    test("enables and reviews training jobs, deployments and models", async ({
      page,
      workPage,
    }) => {
      await workPage.openProjectFromWorkspace("Release Workspace", "Release Project");
      await workPage.enableCapabilityAfterReload("Training");
      await workPage.browseTrainingDashboard();
      await expect(page.getByRole("tab", { name: "Models" })).toHaveAttribute(
        "data-state",
        "active",
      );
      await workPage.removeCapabilityAfterReload("Training");
      await expect(workPage.getCapabilityAddButton("Training")).toBeVisible();
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

    test("creates and removes a workspace and project", async ({ page, workPage }) => {
      await workPage.open();
      await workPage.createWorkspace("Release lifecycle workspace", "Temporary release workspace");
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
    });
  });
});
