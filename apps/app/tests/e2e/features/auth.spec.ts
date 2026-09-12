import { expect, test } from "../fixtures/polychat-test";
import { captureVisualSnapshots, DEFAULT_VISUAL_CHECKPOINTS } from "../support/visual-cloud";

test.describe("Authentication experience", () => {
  test.describe("logged out", () => {
    test.use({ persona: "logged-out" });

    test.beforeEach(async ({ homePage }) => {
      await homePage.navigate("/chat");
    });

    test("opens sign-in from account settings and offers every enabled method", async ({
      authPage,
      page,
    }) => {
      await authPage.enablePasskeySignInOption();
      await authPage.triggerLoginModal();

      const dialog = page.getByRole("dialog");

      await expect(dialog.getByRole("button", { name: "Sign in with GitHub" })).toBeVisible();
      await expect(dialog.getByRole("textbox", { name: "Email Address" })).toBeVisible();
      await expect(dialog.getByRole("button", { name: "Sign in with Passkey" })).toBeVisible();
      await expect(dialog.getByRole("link", { name: "Terms of Service" })).toHaveAttribute(
        "href",
        "/terms",
      );
      await expect(dialog.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute(
        "href",
        "/privacy",
      );
      await captureVisualSnapshots(page, "release-auth-sign-in-methods", {
        ...DEFAULT_VISUAL_CHECKPOINTS,
        fullPage: false,
      });
    });

    test("validates an email without submitting an authentication request", async ({
      authPage,
    }) => {
      await authPage.triggerLoginModal();
      await authPage.loginWithMagicLink("invalid-email");
      await expect(authPage.isMagicLinkEmailValid()).resolves.toBe(false);
    });

    test("requests a magic link and confirms delivery", async ({ authPage, page }) => {
      await authPage.triggerLoginModal();
      await authPage.loginWithMagicLink("release-user@polychat.invalid");
      await expect(page.getByRole("dialog")).toContainText(
        "Check your email for a magic link to sign in.",
      );
      await captureVisualSnapshots(page, "release-auth-magic-link-sent", {
        ...DEFAULT_VISUAL_CHECKPOINTS,
        fullPage: false,
      });
    });

    test("starts GitHub authorisation", async ({ authPage, externalServices, page }) => {
      await externalServices.mockGitHubAuthorization();
      await authPage.triggerLoginModal();
      await authPage.loginWithGitHub();
      await expect(page).toHaveURL(/github\.com\/login\/oauth\/authorize/);
      await expect(page.getByRole("heading", { name: "GitHub authorisation" })).toBeVisible();
    });

    test("rejects an invalid magic-link callback", async ({ homePage, page }) => {
      await homePage.navigate("/auth/verify-magic-link?token=invalid");
      await expect(page.getByText("Verification Failed", { exact: true })).toBeVisible();
      await captureVisualSnapshots(
        page,
        "release-auth-magic-link-rejected",
        DEFAULT_VISUAL_CHECKPOINTS,
      );
    });
  });

  test.describe("signed-in account", () => {
    test.use({ persona: "pro" });

    test("signs out and returns to a protected signed-out state", async ({
      authPage,
      page,
      profilePage,
    }) => {
      await profilePage.openAccount();
      await expect(authPage.isLoggedIn()).resolves.toBe(true);
      await profilePage.logout();
      await expect(page.getByText("Sign in to view your profile", { exact: true })).toBeVisible();
      await captureVisualSnapshots(
        page,
        "release-auth-signed-out-profile",
        DEFAULT_VISUAL_CHECKPOINTS,
      );
      await expect(authPage.isLoggedIn()).resolves.toBe(false);
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.getByText("Sign in to view your profile", { exact: true })).toBeVisible();
      await expect(authPage.isLoggedIn()).resolves.toBe(false);
    });
  });

  test.describe("pro passkey", () => {
    test.use({ persona: "pro" });

    test(
      "signs in with a registered passkey",
      { tag: "@release" },
      async ({ authPage, homePage }) => {
        await authPage.registerSignOutAndSignInWithPasskey();
        await expect(authPage.isLoggedIn()).resolves.toBe(true);
        await homePage.navigate("/chat");
        await homePage.selectModel("GPT OSS 120B");
        await homePage.sendMessageAndRequireCompletion("Reply after passkey sign-in");
        await homePage.waitForChatResponse(0);
        await expect(homePage.getLatestAssistantMessage()).toContainText("E2E response:");
      },
    );

    test("signs out from the shell and stays signed out after reload", async ({
      appPage,
      authPage,
      homePage,
      page,
      profilePage,
    }) => {
      await homePage.navigate("/chat");
      await appPage.openSettings("Pro");
      await page.getByRole("button", { name: "Sign out", exact: true }).click();
      await expect(appPage.settingsButton.getByText("Guest", { exact: true })).toBeVisible();
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(appPage.settingsButton.getByText("Guest", { exact: true })).toBeVisible();
      await profilePage.openAccount();
      await expect(authPage.isLoggedIn()).resolves.toBe(false);
    });
  });
});
