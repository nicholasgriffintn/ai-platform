import { expect, test } from "../fixtures/polychat-test";

test.describe("Application experience", () => {
	test.describe("logged out", () => {
		test.use({ persona: "logged-out" });

		test("navigates Chat, Work, settings, help and legal surfaces", async ({
			appPage,
			homePage,
			page,
		}) => {
			await homePage.navigate("/chat");
			await expect(homePage.chatInput).toBeEditable();

			await appPage.switchProduct("Work");
			await expect(page).toHaveURL(/\/work$/);
			await expect(
				page.getByRole("heading", { name: "Bring your projects together." }),
			).toBeVisible();

			await appPage.switchProduct("Chat");
			await expect(page).toHaveURL(/\/chat$/);

			await appPage.openSettings("Guest");
			await appPage.selectTheme("Dark");
			await expect(page.locator("html")).toHaveClass(/dark/);

			await appPage.openKeyboardShortcuts();
			await expect(page.getByRole("dialog")).toContainText("Toggle Sidebar");
			await appPage.dismissDialog();

			await appPage.openSettings("Guest");
			await appPage.openSettingsDestination("Terms");
			await expect(page).toHaveURL(/\/terms$/);
			await expect(page.getByRole("heading", { name: "Terms of Service" })).toBeVisible();

			await homePage.navigate("/chat");
			await appPage.openSettings("Guest");
			await appPage.openSettingsDestination("Privacy");
			await expect(page).toHaveURL(/\/privacy$/);
			await expect(page.getByRole("heading", { name: "Privacy Policy" })).toBeVisible();
		});

		test("recovers from an unknown route", async ({ appPage, homePage, page }) => {
			await homePage.navigate("/missing-release-route");
			await expect(page.getByRole("heading", { name: "Page Not Found" })).toBeVisible();
			await appPage.followLink("Back to the nest");
			await expect(page).toHaveURL(/\/$/);
			await expect(homePage.chatInput).toBeEditable();
		});
	});

	for (const persona of ["free", "pro"] as const) {
		test.describe(`${persona} account`, () => {
			test.use({ persona });

			test("navigates account and product surfaces with the correct entitlement", async ({
				appPage,
				homePage,
				page,
			}) => {
				const plan = persona === "pro" ? "Pro" : "Free";
				await homePage.navigate("/chat");
				await expect(homePage.chatInput).toBeEditable();
				await expect(appPage.settingsButton).toContainText(`${plan} Release User`);

				await appPage.openSettings(plan);
				await appPage.openSettingsDestination("Account");
				await expect(page).toHaveURL(/\/profile$/);
				await expect(page.getByRole("heading", { name: "Account" })).toBeVisible();

				await homePage.navigate("/chat");
				await appPage.switchProduct("Work");
				if (persona === "pro") {
					await expect(page.getByRole("link", { name: /Release Workspace/ }).first()).toBeVisible();
				} else {
					await expect(
						page.getByRole("heading", { name: "Unlock shared workspaces." }),
					).toBeVisible();
					await appPage.followLink("Upgrade to Pro");
					await expect(page).toHaveURL(/\/profile\?tab=billing$/);
					await expect(page.getByRole("heading", { name: "Billing" })).toBeVisible();
				}
			});
		});
	}

	test.describe("responsive navigation", () => {
		test.use({ persona: "pro", viewport: { width: 390, height: 844 } });

		test("opens and closes the mobile sidebar without losing the active surface", async ({
			appPage,
			homePage,
			page,
		}) => {
			await homePage.navigate("/chat");
			await appPage.toggleSidebar();
			await expect(page.getByRole("button", { name: "Show sidebar" })).toBeVisible();
			await appPage.toggleSidebar();
			await expect(appPage.settingsButton).toBeVisible();
			await expect(homePage.chatInput).toBeEditable();
		});
	});
});
