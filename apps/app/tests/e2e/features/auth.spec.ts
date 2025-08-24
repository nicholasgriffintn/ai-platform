import { test, expect } from "@playwright/test";
import { HomePage } from "../page-objects";
import { TestHelpers } from "../utils/test-helpers";

test.describe("Authentication Feature", () => {
  let homePage: HomePage;

  test.beforeEach(async ({ page }) => {
    homePage = TestHelpers.createHomePage(page);
    await homePage.navigate();
    await TestHelpers.clearLocalStorage(page);
    await homePage.waitForPageLoad();
  });

  test("should show login button when not authenticated", async ({ page }) => {
    const loginButton = page.getByRole("button", { name: /login/i });
    await expect(loginButton).toBeVisible();
  });

  test("should open login modal when login button is clicked", async ({
    page,
  }) => {
    const loginButton = page.getByRole("button", { name: /login/i });
    await loginButton.click();

    const loginModal = page.getByRole("dialog");
    await expect(loginModal).toBeVisible();

    const modalTitle = page.getByText(/sign in to/i);
    await expect(modalTitle).toBeVisible();
  });

  test("should display GitHub authentication option in modal", async ({
    page,
  }) => {
    const loginButton = page.getByRole("button", { name: /login/i });
    await loginButton.click();

    const githubButton = page.getByRole("button", {
      name: /sign in with github/i,
    });
    await expect(githubButton).toBeVisible();
  });

  test("should display email magic link option in modal", async ({ page }) => {
    const loginButton = page.getByRole("button", { name: /login/i });
    await loginButton.click();

    const emailInput = page.getByRole("textbox", { name: /email/i });
    const emailButton = page.getByRole("button", {
      name: /sign in with email/i,
    });

    await expect(emailInput).toBeVisible();
    await expect(emailButton).toBeVisible();
  });

  test("should handle magic link email submission", async ({ page }) => {
    const loginButton = page.getByRole("button", { name: /login/i });
    await loginButton.click();

    const emailInput = page.getByRole("textbox", { name: /email/i });
    const submitButton = page.getByRole("button", {
      name: /sign in with email/i,
    });

    await emailInput.fill("test@example.com");
    await submitButton.click();

    const successMessage = page.getByText(/check your email/i);
    await expect(successMessage).toBeVisible();
  });

  test("should show validation error for invalid email", async ({ page }) => {
    const loginButton = page.getByRole("button", { name: /login/i });
    await loginButton.click();

    const emailInput = page.getByRole("textbox", { name: /email/i });
    const submitButton = page.getByRole("button", {
      name: /sign in with email/i,
    });

    await emailInput.fill("invalid-email");
    await submitButton.click();

    const errorMessage = page.getByText(/please enter a valid email/i);
    await expect(errorMessage).toBeVisible();
  });

  test("should close modal when clicking outside", async ({ page }) => {
    const loginButton = page.getByRole("button", { name: /login/i });
    await loginButton.click();

    const loginModal = page.getByRole("dialog");
    await expect(loginModal).toBeVisible();

    await page.click("body", { position: { x: 10, y: 10 } });

    await expect(loginModal).not.toBeVisible();
  });

  test("should show passkey option when supported", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, "PublicKeyCredential", {
        value: class PublicKeyCredential {
          static isUserVerifyingPlatformAuthenticatorAvailable() {
            return Promise.resolve(true);
          }
        },
        configurable: true,
      });
    });

    const loginButton = page.getByRole("button", { name: /login/i });
    await loginButton.click();

    const passkeyButton = page.getByRole("button", {
      name: /sign in with passkey/i,
    });
    await expect(passkeyButton).toBeVisible();
  });
});
