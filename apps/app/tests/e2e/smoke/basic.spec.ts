import { expect, test } from "../fixtures/polychat-test";

const TEXT_MODEL = "Compound Mini";

test.describe("Release smoke as logged out", () => {
	test.use({ persona: "logged-out" });

	test("answers in Chat and protects Work", async ({ homePage, page, workPage }) => {
		await homePage.navigate("/chat");
		await homePage.waitForPersonaReady("logged-out");
		await homePage.selectModel(TEXT_MODEL);
		await homePage.sendMessageAndRequireCompletion("Check the logged-out release path");
		await homePage.waitForChatResponse(0);
		await expect(homePage.getLatestAssistantMessage()).toContainText("E2E response:");

		await workPage.open();
		await expect(
			page.getByRole("heading", { name: "Bring your projects together." }),
		).toBeVisible();
		await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
	});
});

test.describe("Release smoke as Free", () => {
	test.use({ persona: "free" });

	test("answers in Chat, enforces Work entitlement and syncs providers", async ({
		homePage,
		page,
		profilePage,
		workPage,
	}) => {
		await homePage.navigate("/chat");
		await homePage.waitForPersonaReady("free");
		await homePage.selectModel(TEXT_MODEL);
		await homePage.sendMessageAndRequireCompletion("Check the Free release path");
		await homePage.waitForChatResponse(0);
		await expect(homePage.getLatestAssistantMessage()).toContainText("E2E response:");

		await workPage.open();
		await expect(page.getByRole("heading", { name: "Unlock shared workspaces." })).toBeVisible();

		await profilePage.openProviders();
		await expect(profilePage.providerSyncNotice).toBeVisible();
		await profilePage.syncProvidersFromNotice();
		await expect(page.getByRole("button").filter({ hasText: "bedrock" }).first()).toBeVisible();
	});
});

test.describe("Release smoke as Pro", () => {
	test.use({ persona: "pro" });

	test("opens a Work project and completes its conversation", async ({ homePage, workPage }) => {
		await workPage.openProjectFromWorkspace("Release Workspace", "Release Project");
		await workPage.openNewProjectConversation();
		await homePage.selectModel(TEXT_MODEL);
		await homePage.sendMessageAndRequireCompletion("Check the Pro Work release path");
		await homePage.waitForChatResponse(0);
		await expect(homePage.getLatestAssistantMessage()).toContainText("E2E response:");
	});
});
