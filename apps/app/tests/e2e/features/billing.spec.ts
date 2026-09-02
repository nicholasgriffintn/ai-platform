import type { UsageLedgerSeed } from "../fixtures/polychat-test";
import { expect, test } from "../fixtures/polychat-test";

const MODEL = "GPT OSS 120B";

const FREE_LEDGER: UsageLedgerSeed[] = [
  {
    source: "model",
    vendor: "cerebras",
    resource: "gpt-oss-120b",
    unit: "tokens",
    quantity: 420_000,
    costMicros: 600_000,
    credits: 60,
  },
  {
    source: "model",
    vendor: "openai",
    resource: "gpt-5.2",
    unit: "tokens",
    quantity: 120_000,
    costMicros: 300_000,
    credits: 30,
  },
  {
    source: "infrastructure",
    vendor: "cloudflare",
    resource: "sandbox-run",
    unit: "seconds",
    quantity: 900,
    costMicros: 100_000,
    credits: 10,
  },
];

const PRO_LEDGER: UsageLedgerSeed[] = [
  {
    source: "model",
    vendor: "cerebras",
    resource: "gpt-oss-120b",
    unit: "tokens",
    quantity: 2_400_000,
    costMicros: 3_000_000,
    credits: 300,
  },
  {
    source: "model",
    vendor: "anthropic",
    resource: "claude-opus",
    unit: "tokens",
    quantity: 300_000,
    costMicros: 900_000,
    credits: 90,
  },
  {
    source: "infrastructure",
    vendor: "cloudflare",
    resource: "sandbox-run",
    unit: "seconds",
    quantity: 1_800,
    costMicros: 300_000,
    credits: 30,
  },
];

test.describe("Credit billing", () => {
  test.describe("signed out", () => {
    test.use({ persona: "logged-out" });

    test("offers the plan ladder and the anonymous allowance", async ({
      appPage,
      authPage,
      homePage,
      page,
      pricingPage,
    }) => {
      await homePage.navigate("/chat");
      await appPage.openSettings("Guest");
      await expect(appPage.usageMeter).toHaveAttribute(
        "aria-label",
        "0 of 20 credits used this month",
      );

      await pricingPage.open();
      expect(await pricingPage.planOrder()).toEqual(["Free", "Pro"]);

      await expect(pricingPage.planCard("Free")).toContainText("100 credits every month");
      await expect(pricingPage.planCard("Free")).not.toContainText("reserve");
      await expect(pricingPage.planCard("Pro")).toContainText("£8");
      await expect(pricingPage.planCard("Pro")).toContainText("500 credits every month");
      await expect(pricingPage.planCard("Pro")).toContainText("plus a 50 credit reserve");

      const checkoutAttempts: string[] = [];

      page.on("request", (request) => {
        if (new URL(request.url()).pathname.endsWith("/stripe/checkout")) {
          checkoutAttempts.push(request.url());
        }
      });

      await pricingPage.choosePlan("Free");
      expect(await authPage.isLoginModalVisible()).toBe(true);
      expect(checkoutAttempts).toEqual([]);
      await expect(page).toHaveURL(/\/pricing$/);
    });
  });

  test.describe("free account", () => {
    test.use({
      persona: "free",
      billing: { spentCredits: 100, ledger: FREE_LEDGER },
    });

    test("stops at the ceiling with no reserve and no overage", async ({
      billingPage,
      homePage,
      page,
    }) => {
      await billingPage.open();
      expect(await billingPage.creditsAllowance()).toBe(
        "100 of 100 included credits used, 0 of reserve remaining",
      );
      await expect(billingPage.creditState).toHaveText("Out of credits");
      await expect(billingPage.creditsFigure("Reserve remaining")).toHaveText("0");
      await expect(billingPage.overageToggle).toHaveCount(0);

      await expect(billingPage.spendSummaryTotals).toHaveText("100 credits · 3 events");
      await expect(billingPage.spendSummary).toContainText("Models");
      await expect(billingPage.spendSummary).toContainText("Infrastructure");

      await expect(billingPage.activeLedgerFilter()).toHaveText("Models");
      await expect(billingPage.ledgerRows().filter({ hasText: "Cloudflare" })).toHaveCount(0);

      await homePage.navigate("/chat");
      await homePage.selectModel(MODEL);
      await homePage.sendMessage("Free release turn past the ceiling");
      await expect(page.getByText(/This month's credits are fully spent/).first()).toBeVisible();
      await expect(page.getByText("E2E response:")).toHaveCount(0);
      await expect(homePage.chatInput).toBeEditable();
    });
  });

  test.describe("pro account", () => {
    test.use({
      persona: "pro",
      billing: { spentCredits: 420, subscribed: true, ledger: PRO_LEDGER },
    });

    test("carries a Pro account from on track through its reserve to a pause", async ({
      billingPage,
      billingState,
      homePage,
      page,
    }) => {
      await billingPage.open();
      expect(await billingPage.creditsAllowance()).toBe(
        "420 of 500 included credits used, 130 of reserve remaining",
      );
      await expect(billingPage.creditState).toHaveText("On track");
      await expect(billingPage.creditsFigure("Reserve")).toHaveText("50");
      await expect(billingPage.overageToggle).toBeVisible();
      await expect(billingPage.overageToggle).not.toBeChecked();

      await expect(billingPage.activeLedgerFilter()).toHaveText("Models");
      await expect(billingPage.ledgerRows().first()).toContainText("Cerebras · gpt-oss-120b");
      await expect(billingPage.ledgerRows().filter({ hasText: "Cloudflare" })).toHaveCount(0);

      await billingPage.filterLedgerBy("Infrastructure");
      await expect(billingPage.ledgerRows().filter({ hasText: "sandbox-run" })).toHaveCount(1);
      await expect(billingPage.ledgerRows().filter({ hasText: "gpt-oss-120b" })).toHaveCount(0);

      await billingPage.filterLedgerBy("All");
      await expect(billingPage.ledgerRows().filter({ hasText: "gpt-oss-120b" })).not.toHaveCount(0);
      await expect(billingPage.ledgerRows().filter({ hasText: "sandbox-run" })).toHaveCount(1);

      await homePage.navigate("/chat");
      await homePage.selectModel(MODEL);
      await homePage.sendMessage("Pro release turn while on track");
      await homePage.waitForChatResponse(0);
      await expect(homePage.getLatestAssistantMessage()).toContainText("E2E response:");
      await expect(homePage.composerBanner("into your reserve")).toHaveCount(0);

      await billingState.set({ spentCredits: 510, subscribed: true, ledger: PRO_LEDGER });
      await billingPage.open();
      expect(await billingPage.creditsAllowance()).toBe(
        "510 of 500 included credits used, 40 of reserve remaining",
      );
      await expect(billingPage.creditState).toHaveText("In reserve");
      await expect(billingPage.creditsFigure("Reserve remaining")).toHaveText("40");

      await homePage.navigate("/chat");
      await homePage.selectModel(MODEL);
      await homePage.sendMessage("Pro release turn inside the reserve");
      await homePage.waitForChatResponse(0);
      await expect(homePage.getLatestAssistantMessage()).toContainText("E2E response:");
      await expect(homePage.composerBanner("into your reserve")).toBeVisible();
      await expect(page.getByText(/This month's credits are fully spent/)).toHaveCount(0);

      await billingState.set({ spentCredits: 550, subscribed: true, ledger: PRO_LEDGER });
      await billingPage.open();
      await expect(billingPage.creditState).toHaveText("Out of credits");

      await homePage.navigate("/chat");
      await homePage.selectModel(MODEL);
      await homePage.sendMessage("Pro release turn past the reserve");
      await expect(page.getByText(/This month's credits are fully spent/).first()).toBeVisible();
      await expect(page.getByText("E2E response:")).toHaveCount(0);
    });
  });

  test.describe("pro account with overage enabled", () => {
    test.use({
      persona: "pro",
      billing: {
        spentCredits: 560,
        overageCredits: 12,
        overageEnabled: true,
        subscribed: true,
        ledger: PRO_LEDGER,
      },
    });

    test("keeps working past the reserve once overage is on", async ({
      billingPage,
      homePage,
      page,
    }) => {
      await billingPage.open();
      await expect(billingPage.creditState).toHaveText("In overage");
      await expect(billingPage.creditsCard).toContainText(
        "12 credits of overage so far this period.",
      );
      await expect(billingPage.overageToggle).toBeChecked();

      await homePage.navigate("/chat");
      await homePage.selectModel(MODEL);
      await homePage.sendMessage("Pro release turn on overage");
      await homePage.waitForChatResponse(0);
      await expect(homePage.getLatestAssistantMessage()).toContainText("E2E response:");
      await expect(page.getByText(/This month's credits are fully spent/)).toHaveCount(0);
    });
  });
});
