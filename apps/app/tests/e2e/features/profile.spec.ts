import { readFile } from "node:fs/promises";

import { expect, test } from "../fixtures/polychat-test";
import { createGitHubPrivateKeyFixture } from "../fixtures/test-data";
import { captureVisualSnapshots, DEFAULT_VISUAL_CHECKPOINTS } from "../support/visual-cloud";

const PROFILE_TABS = [
  ["account", "Account"],
  ["passkeys", "Passkeys"],
  ["customisation", "Customise Chat"],
  ["history", "Chat History"],
  ["providers", "Available Providers"],
  ["sandbox", "Sandbox"],
  ["agents", "Agents"],
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

      test("opens every account configuration surface", async ({ page, profilePage }) => {
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
        await expect(page.getByText("Billing features are currently disabled.")).toBeVisible();
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

  test("creates, edits and deletes an agent", async ({ page, profilePage }) => {
    const persistedSettings = await profilePage.createAndDeleteAgent(
      "Release validation agent",
      "Checks release readiness.",
    );
    expect(persistedSettings).toEqual({ temperature: "0.2", maxSteps: "7" });
    await expect(page.getByText("Release validation agent", { exact: true })).toHaveCount(0);
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
      await homePage.selectModel("Compound Mini");
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
      await homePage.selectModel("Compound Mini");
      await homePage.sendMessage(message);
      await homePage.waitForChatResponse(0);
      const title = /Export this Pro release conv|Release validation chat/;
      await homePage.waitForConversationInHistory(title);

      const download = await profilePage.exportChatHistory();
      expect(download.suggestedFilename()).toMatch(/^chat-history-.+\.json$/);
      const downloadPath = await download.path();
      if (!downloadPath) throw new Error("Chat history export did not create a download");
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
