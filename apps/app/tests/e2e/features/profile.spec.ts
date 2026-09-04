import { readFile } from "node:fs/promises";

import { expect, test } from "../fixtures/polychat-test";
import { createGitHubPrivateKeyFixture } from "../fixtures/test-data";
import { captureVisualSnapshots, DEFAULT_VISUAL_CHECKPOINTS } from "../support/visual-cloud";

const PROFILE_TABS = [
  ["account", "Account"],
  ["passkeys", "Passkeys"],
  ["customisation", "Customise Chat"],
  ["pets", "Your pet"],
  ["history", "Chat History"],
  ["providers", "Available Providers"],
  ["sandbox", "Sandbox"],
  ["billing", "Billing"],
  ["api-keys", "API Keys"],
  ["tasks", "Tasks"],
  ["sources", "Sources"],
] as const;

test.describe("Profile experience", () => {
  test.describe("logged out", () => {
    test.use({ persona: "logged-out" });

    test("protects every account configuration surface", async ({ homePage, page }) => {
      for (const [tab] of PROFILE_TABS) {
        await test.step(tab, async () => {
          await homePage.navigate(`/profile?tab=${tab}`);
          await expect(
            page.getByText("Sign in to view your profile", { exact: true }),
          ).toBeVisible();
          await captureVisualSnapshots(page, `release-profile-logged-out-${tab}`, {
            ...DEFAULT_VISUAL_CHECKPOINTS,
            viewports: [{ name: "desktop", width: 1280, height: 720 }],
          });
        });
      }
    });
  });

  for (const persona of ["free", "pro"] as const) {
    test.describe(`${persona} account`, () => {
      test.use({ persona });

      test("opens every account configuration surface", async ({
        billingPage,
        page,
        profilePage,
      }) => {
        test.slow();
        await profilePage.openAccount();
        await expect(
          page.getByText(persona === "pro" ? "Pro plan" : "Free plan", { exact: true }),
        ).toBeVisible();

        for (const [tab, heading] of PROFILE_TABS) {
          await test.step(tab, async () => {
            await profilePage.openTab(tab, heading);
            if (tab === "tasks" && persona === "free") {
              await expect(
                page.getByText("No tasks found. Trigger a memory synthesis to get started!", {
                  exact: true,
                }),
              ).toBeVisible();
            }

            await captureVisualSnapshots(page, `release-profile-${persona}-${tab}`, {
              ...DEFAULT_VISUAL_CHECKPOINTS,
              viewports: [{ name: "desktop", width: 1280, height: 720 }],
            });
          });
        }

        await profilePage.openTab("billing", "Billing");
        await expect(billingPage.creditsMeter).toHaveAttribute(
          "aria-label",
          persona === "pro"
            ? /of 1,500 included credits used, 1,650 of reserve remaining$/
            : /of 150 included credits used, 200 of reserve remaining$/,
        );
        await expect(billingPage.creditState).toHaveText("On track");
        await captureVisualSnapshots(page, `release-profile-${persona}-billing`, {
          ...DEFAULT_VISUAL_CHECKPOINTS,
          viewports: [{ name: "desktop", width: 1280, height: 720 }],
        });
      });

      test("persists chat customisation", async ({ page, profilePage }) => {
        const settings = {
          nickname: `${persona} release nickname`,
          jobRole: "Release validator",
          preferences: `Keep ${persona} release answers concise.`,
          searchProvider: "duckduckgo",
        };

        await profilePage.updateCustomisation(settings);
        await profilePage.reload();
        await expect(page.getByLabel("Nickname", { exact: true })).toHaveValue(settings.nickname);
        await expect(page.getByLabel("Job Role", { exact: true })).toHaveValue(settings.jobRole);
        await expect(page.getByLabel("Preferences", { exact: true })).toHaveValue(
          settings.preferences,
        );
        await expect(page.getByLabel("Search Provider", { exact: true })).toHaveValue(
          settings.searchProvider,
        );

        await profilePage.selectPresetPet("Ash");
        await profilePage.openTab("customisation", "Customise Chat");
        await expect(page.getByLabel("Nickname", { exact: true })).toHaveValue(settings.nickname);
        await expect(page.getByLabel("Job Role", { exact: true })).toHaveValue(settings.jobRole);
        await expect(page.getByLabel("Preferences", { exact: true })).toHaveValue(
          settings.preferences,
        );
        await expect(page.getByLabel("Search Provider", { exact: true })).toHaveValue(
          settings.searchProvider,
        );

        await captureVisualSnapshots(page, `release-profile-${persona}-customisation`, {
          ...DEFAULT_VISUAL_CHECKPOINTS,
          viewports: [{ name: "desktop", width: 1280, height: 720 }],
        });
      });
    });
  }
});

test.describe("Provider configuration", () => {
  test.use({ persona: "free" });

  test("explains and resolves an out-of-date provider catalogue", async ({ profilePage, page }) => {
    await profilePage.openProviders();
    await expect(profilePage.providerSyncNotice).toContainText(
      "New providers have not been synced to your account yet.",
    );
    await profilePage.syncProvidersFromNotice();
    await expect(profilePage.providerSyncNotice).toHaveCount(0);
    await expect(page.getByRole("button").filter({ hasText: "bedrock" }).first()).toBeVisible();
    await captureVisualSnapshots(page, "release-profile-provider-catalog", {
      ...DEFAULT_VISUAL_CHECKPOINTS,
      viewports: [{ name: "desktop", width: 1280, height: 720 }],
    });
  });

  test("stores and removes a standard AI provider key", async ({ profilePage, page }) => {
    await profilePage.openProviders();
    await profilePage.configureProvider("OpenAI", "e2e-openai-provider-key");
    await expect(page.getByLabel("Connected")).toBeVisible();
    await profilePage.removeProvider("OpenAI");
    await expect(page.getByLabel("Connected")).toHaveCount(0);
    await captureVisualSnapshots(page, "release-profile-provider-openai", {
      ...DEFAULT_VISUAL_CHECKPOINTS,
      viewports: [{ name: "desktop", width: 1280, height: 720 }],
    });
  });

  test("stores and removes an AWS AI provider key pair", async ({ profilePage, page }) => {
    await profilePage.openProviders();
    await profilePage.syncProviders();
    await profilePage.configureAwsProvider(
      "bedrock",
      "AKIAE2ERELEASEVALIDATION",
      "e2e-bedrock-secret-access-key",
    );
    await expect(page.getByLabel("Connected")).toBeVisible();
    await profilePage.removeProvider("bedrock");
    await expect(page.getByLabel("Connected")).toHaveCount(0);
    await captureVisualSnapshots(page, "release-profile-provider-bedrock", {
      ...DEFAULT_VISUAL_CHECKPOINTS,
      viewports: [{ name: "desktop", width: 1280, height: 720 }],
    });
  });

  test("stores and removes structured messaging credentials", async ({ profilePage, page }) => {
    await profilePage.openProviders();
    await profilePage.syncProviders();
    await profilePage.configureProviderFields("Twilio SMS", {
      "Account SID": "AC00000000000000000000000000000000",
      "Auth Token": "e2e-twilio-auth-token",
      "Allowed Senders": "+15557654321",
      "From Phone Number": "+15551234567",
    });
    await expect(page.getByLabel("Connected")).toBeVisible();
    await profilePage.removeProvider("Twilio SMS");
    await expect(page.getByLabel("Connected")).toHaveCount(0);
    await captureVisualSnapshots(page, "release-profile-provider-twilio", {
      ...DEFAULT_VISUAL_CHECKPOINTS,
      viewports: [{ name: "desktop", width: 1280, height: 720 }],
    });
  });

  test("stores and removes AWS messaging credentials", async ({ profilePage, page }) => {
    await profilePage.openProviders();
    await profilePage.syncProviders();
    await profilePage.configureProviderFields("AWS End User Messaging", {
      "AWS Access Key ID": "AKIAE2EMESSAGINGVALIDATION",
      "AWS Secret Access Key": "e2e-messaging-secret-access-key",
      "AWS Region": "eu-west-2",
      "Allowed Senders": "+447700900456",
      "Origination Identity": "+447700900123",
    });
    await expect(page.getByLabel("Connected")).toBeVisible();
    await profilePage.removeProvider("AWS End User Messaging");
    await expect(page.getByLabel("Connected")).toHaveCount(0);
    await captureVisualSnapshots(page, "release-profile-provider-aws-messaging", {
      ...DEFAULT_VISUAL_CHECKPOINTS,
      viewports: [{ name: "desktop", width: 1280, height: 720 }],
    });
  });
});

test.describe("Connector configuration", () => {
  test.use({ persona: "pro" });

  test("stores and removes an API-key connector credential", async ({ profilePage, page }) => {
    await profilePage.openProviders("connector");
    await profilePage.connectApiKeyConnector("Netlify", "e2e-netlify-personal-access-token");
    await profilePage.filterProviders("Netlify");
    await expect(page.getByLabel("Connected")).toBeVisible();
    await profilePage.disconnectConnector("Netlify");
    await expect(page.getByLabel("Connected")).toHaveCount(0);
    await captureVisualSnapshots(page, "release-profile-connector-netlify", {
      ...DEFAULT_VISUAL_CHECKPOINTS,
      viewports: [{ name: "desktop", width: 1280, height: 720 }],
    });
  });

  test("authorises and disconnects an OAuth connector", async ({
    externalServices,
    profilePage,
    page,
  }) => {
    await externalServices.mockComposioAuthorization();
    await profilePage.openProviders("connector");
    await profilePage.connectOAuthConnector("Airtable");
    await profilePage.filterProviders("Airtable");
    await expect(page.getByLabel("Connected")).toBeVisible();
    await profilePage.disconnectConnector("Airtable");
    await expect(page.getByLabel("Connected")).toHaveCount(0);
    await captureVisualSnapshots(page, "release-profile-connector-airtable", {
      ...DEFAULT_VISUAL_CHECKPOINTS,
      viewports: [{ name: "desktop", width: 1280, height: 720 }],
    });
  });
});

test.describe("Account-owned resources", () => {
  test.use({ persona: "pro" });

  test("revises, promotes, rolls back and archives an authored skill", async ({ polychatApi }) => {
    const result = await polychatApi.exercisePersonalSkillRevisionLifecycle({
      name: "release-skill-lifecycle",
      initialInstructions: "Answer with the stable release procedure.",
      revisedInstructions: "Answer with the revised release procedure.",
      resourceContent: "Release evidence belongs in the verification queue.",
    });

    expect(result.draft.revision.revision).toBeGreaterThan(result.initialRevision.revision);
    expect(result.promoted.state.stableRevisionId).toBe(result.draft.revision.id);
    expect(result.rolledBack.revision.revision).toBeGreaterThan(result.promoted.revision.revision);
    expect(result.rolledBack.content).toContain("stable release procedure");
    expect(result.retrieved.resources).toEqual([
      {
        path: "references/evidence.md",
        content: "Release evidence belongs in the verification queue.",
      },
    ]);
    expect(result.archivedStatus).toBe(404);
    expect(result.recreated.name).toBe("release-skill-lifecycle");
  });

  test("applies and removes a model-maker pet rule with a deliberate fallback", async ({
    homePage,
    page,
    profilePage,
  }) => {
    await profilePage.openTab("pets", "Your pet");
    await expect(page.getByRole("button", { name: /^Pip/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await profilePage.addPetMakerRule("OpenAI", "Ash");
    await expect(page.getByLabel("Pet for OpenAI", { exact: true })).toHaveValue("preset:ash");
    await profilePage.enablePetTravel();

    await homePage.navigate("/chat");
    await homePage.selectModel("GPT-5.5");
    await expect(page.getByRole("button", { name: /^Ash\./ })).toBeVisible();
    await homePage.selectModel("GPT OSS 120B");
    await expect(page.getByRole("button", { name: /^Ash\./ })).toBeVisible();
    await homePage.selectModel("Llama 4 Scout 17B");
    await expect(page.getByRole("button", { name: /^Pip\./ })).toBeVisible();

    await profilePage.openTab("pets", "Your pet");
    await profilePage.removePetMakerRule("OpenAI");
    await expect(
      page.getByText("No rules yet, so every model gets your default pet."),
    ).toBeVisible();
    await homePage.navigate("/chat");
    await homePage.selectModel("GPT OSS 120B");
    await expect(page.getByRole("button", { name: /^Pip\./ })).toBeVisible();
  });

  test("creates and revokes an application API key", async ({ page, profilePage }) => {
    await profilePage.createAndDeleteApiKey("Release validation key");
    await expect(page.getByText("Release validation key", { exact: true })).toHaveCount(0);
    await captureVisualSnapshots(page, "release-profile-api-key", {
      ...DEFAULT_VISUAL_CHECKPOINTS,
      viewports: [{ name: "desktop", width: 1280, height: 720 }],
    });
  });

  test("groups reusable source material in a collection and deletes both", async ({
    page,
    profilePage,
  }) => {
    await profilePage.createSourceCollectionWithSource(
      "Release validation collection",
      "Release validation source",
      "Source material for the release-validation journey.",
    );
    await expect(page.getByText("Release validation source", { exact: true })).toBeVisible();
    await profilePage.deleteSourceCollectionAndSource(
      "Release validation collection",
      "Release validation source",
    );
    await expect(page.getByText("Release validation source", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Release validation collection", { exact: true })).toHaveCount(0);
    await captureVisualSnapshots(page, "release-profile-sources", {
      ...DEFAULT_VISUAL_CHECKPOINTS,
      viewports: [{ name: "desktop", width: 1280, height: 720 }],
    });
  });

  test("creates, edits and deletes an agent", async ({ capabilitiesPage, page }) => {
    const agentName = "Release validation agent";

    await capabilitiesPage.open();
    await capabilitiesPage.startNewAgent();
    await expect(page.getByRole("tab", { name: "Team", exact: true })).toHaveCount(0);
    await expect(page.getByText("Team agents", { exact: true })).toHaveCount(0);
    expect(await capabilitiesPage.legacyTeamEndpointStatus()).toBe(404);
    await capabilitiesPage.fillAgentEditor({
      name: agentName,
      description: "Checks release readiness.",
      systemPrompt: "Answer release questions concisely.",
      temperature: "0.2",
      maxSteps: "7",
    });
    await capabilitiesPage.createAgent();
    await expect(page).toHaveURL(/\/chat\/agents\/[^/]+$/);

    await capabilitiesPage.reload();
    expect(await capabilitiesPage.readAgentModelSettings()).toEqual({
      temperature: "0.2",
      maxSteps: "7",
    });

    await capabilitiesPage.updateAgentDescription("Checks release readiness. Updated.");
    await capabilitiesPage.open();
    await expect(capabilitiesPage.capabilityCard(agentName)).toContainText(
      "Checks release readiness. Updated.",
    );

    await capabilitiesPage.deleteAgentFromLibrary(agentName);
    await expect(page.getByText(agentName, { exact: true })).toHaveCount(0);
  });

  test("keeps credit-accounting tasks out of the account task list", async ({
    homePage,
    page,
    profilePage,
  }) => {
    await homePage.navigate("/chat");
    await homePage.selectModel("GPT OSS 120B");
    await homePage.sendMessageAndRequireCompletion("Create usage for the task-list check");
    await homePage.waitForChatResponse(0);
    await profilePage.openTab("tasks", "Tasks");

    await expect(page.getByText(/usage_rollup/i)).toHaveCount(0);
    await expect(page.getByText(/realtime_reconciliation/i)).toHaveCount(0);
    await expect(page.getByText(/infra_reconciliation/i)).toHaveCount(0);
    await expect(page.getByText(/stripe_usage_sync/i)).toHaveCount(0);
    await expect(
      page.getByText("No tasks found. Trigger a memory synthesis to get started!", {
        exact: true,
      }),
    ).toBeVisible();
  });

  test("registers and removes a passkey", async ({ page, profilePage }) => {
    await profilePage.createAndDeletePasskey();
    await expect(page.getByText("No passkeys added", { exact: true })).toBeVisible();
    await captureVisualSnapshots(page, "release-profile-passkeys", {
      ...DEFAULT_VISUAL_CHECKPOINTS,
      viewports: [{ name: "desktop", width: 1280, height: 720 }],
    });
  });

  test("stores and removes a sandbox GitHub connection", async ({ page, profilePage }) => {
    await profilePage.createAndDeleteSandboxConnection("424242", createGitHubPrivateKeyFixture());
    await expect(page.getByText("Installation 424242", { exact: true })).toHaveCount(0);
    await captureVisualSnapshots(page, "release-profile-sandbox-github", {
      ...DEFAULT_VISUAL_CHECKPOINTS,
      viewports: [{ name: "desktop", width: 1280, height: 720 }],
    });
  });
});

test.describe("Chat history controls", () => {
  test.describe("free", () => {
    test.use({ persona: "free" });

    test("deletes local conversation history", async ({ homePage, page, profilePage }) => {
      await homePage.navigate("/chat");
      await homePage.selectModel("GPT OSS 120B");
      await homePage.sendMessage("Delete this Free release conversation");
      await homePage.waitForChatResponse(0);
      const title = /Delete this Free release conve|Release validation chat/;

      await homePage.waitForConversationInHistory(title);

      await profilePage.deleteAllLocalChats();
      await homePage.navigate("/chat");
      await expect(page.getByRole("button").filter({ hasText: title })).toHaveCount(0);
      await captureVisualSnapshots(page, "release-profile-local-history", {
        ...DEFAULT_VISUAL_CHECKPOINTS,
        viewports: [{ name: "desktop", width: 1280, height: 720 }],
      });
    });
  });

  test.describe("pro", () => {
    test.use({ persona: "pro" });

    test("exports and deletes server conversation history", async ({
      homePage,
      page,
      profilePage,
    }) => {
      const message = "Export this Pro release conversation";

      await homePage.navigate("/chat");
      await homePage.selectModel("GPT OSS 120B");
      await homePage.sendMessage(message);
      await homePage.waitForChatResponse(0);
      const title = /Export this Pro release conv|Release validation chat/;

      await homePage.waitForConversationInHistory(title);

      const download = await profilePage.exportChatHistory();

      expect(download.suggestedFilename()).toMatch(/^chat-history-.+\.json$/);
      const downloadPath = await download.path();

      if (!downloadPath) {
        throw new Error("Chat history export did not create a download");
      }

      expect(await readFile(downloadPath, "utf8")).toContain(message);

      await profilePage.deleteAllRemoteChats();
      await homePage.navigate("/chat");
      await expect(page.getByRole("button").filter({ hasText: title })).toHaveCount(0);
      await captureVisualSnapshots(page, "release-profile-server-history", {
        ...DEFAULT_VISUAL_CHECKPOINTS,
        viewports: [{ name: "desktop", width: 1280, height: 720 }],
      });
    });
  });
});
