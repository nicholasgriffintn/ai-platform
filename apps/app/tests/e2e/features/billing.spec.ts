import { usageSummaryResponseSchema } from "@ngriffin_uk/polychat-schemas";
import { formatCredits } from "@ngriffin_uk/polychat-utility-core";

import { PolychatApi } from "../fixtures/polychat-api";
import type { UsageLedgerSeed } from "../fixtures/polychat-test";
import { expect, provisionPersonaSession, test } from "../fixtures/polychat-test";

const MODEL = "GPT OSS 120B";

const FREE_LEDGER: UsageLedgerSeed[] = [
  {
    source: "model",
    vendor: "cerebras",
    resource: "gpt-oss-120b",
    unit: "input_tokens",
    quantity: 420_000,
    costMicros: 600_000,
    credits: 120,
  },
  {
    source: "model",
    vendor: "openai",
    resource: "gpt-5.2",
    unit: "input_tokens",
    quantity: 120_000,
    costMicros: 300_000,
    credits: 60,
  },
  {
    source: "infrastructure",
    vendor: "cloudflare",
    resource: "sandbox-run",
    unit: "container_vcpu_seconds",
    quantity: 900,
    costMicros: 100_000,
    credits: 20,
  },
];

const PRO_LEDGER: UsageLedgerSeed[] = [
  {
    source: "model",
    vendor: "cerebras",
    resource: "gpt-oss-120b",
    unit: "input_tokens",
    quantity: 2_400_000,
    costMicros: 3_000_000,
    credits: 300,
  },
  {
    source: "model",
    vendor: "anthropic",
    resource: "claude-opus",
    unit: "input_tokens",
    quantity: 300_000,
    costMicros: 900_000,
    credits: 90,
  },
  {
    source: "infrastructure",
    vendor: "cloudflare",
    resource: "sandbox-run",
    unit: "container_vcpu_seconds",
    quantity: 1_800,
    costMicros: 300_000,
    credits: 30,
  },
];

const PAGINATED_LEDGER: UsageLedgerSeed[] = Array.from({ length: 27 }, (_, index) => ({
  source: "model",
  vendor: index === 0 ? "openai" : "cerebras",
  resource: index === 0 ? "gpt-5.6" : `gpt-oss-120b-${index}`,
  unit: "input_tokens",
  quantity: 1_000 + index,
  costMicros: 10_000 + index,
  credits: index === 0 ? 0 : 1,
  byok: index === 0,
}));

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
        "0 of 15 credits used this month",
      );

      await pricingPage.open();
      expect(await pricingPage.planOrder()).toEqual(["Free", "Pro"]);

      await expect(pricingPage.planCard("Free")).toContainText("150 credits every month");
      await expect(pricingPage.planCard("Free")).toContainText("plus a 50 credit reserve");
      await expect(pricingPage.planCard("Pro")).toContainText("£8");
      await expect(pricingPage.planCard("Pro")).toContainText("1,500 credits every month");
      await expect(pricingPage.planCard("Pro")).toContainText("plus a 150 credit reserve");

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

    test("streams anonymous credits, rolls the month and refuses exhausted spend", async ({
      billingState,
      homePage,
      page,
      polychatApi,
    }) => {
      await homePage.navigate("/chat");
      await homePage.selectModel(MODEL);
      const firstTurn = await homePage.sendMessageAndReadCompletionStream(
        "Record anonymous release usage",
      );

      expect(firstTurn.status).toBe(200);
      expect(firstTurn.body).toContain('"usage_limits"');
      expect(firstTurn.body).toContain('"included":15');
      expect(firstTurn.body).not.toContain('"daily"');
      await homePage.waitForChatResponse(0);
      const firstCompletionId = homePage.completionIdFromRequest(firstTurn.request);
      const firstBalance = await polychatApi.getAccountUsageBalance();

      expect(firstBalance.credits.used).toBeGreaterThan(0);
      expect(await polychatApi.accountUsageEventsStatus()).toBe(401);
      const firstAnonymousState = await polychatApi.getAnonymousUsageState(firstCompletionId);

      expect(firstAnonymousState.spent_credit_micros).toBeGreaterThan(0);
      expect(await polychatApi.speechStatus()).toBe(200);
      expect(await polychatApi.speechStatus("elevenlabs")).toBe(401);
      expect(await polychatApi.transcriptionStatus()).toBe(401);
      await homePage.startNewChat();
      await homePage.selectModel(MODEL);
      await homePage.sendMessage("Accumulate a second anonymous release turn");
      await homePage.waitForChatResponse(0);
      expect((await polychatApi.getAccountUsageBalance()).credits.used).toBeGreaterThan(
        firstBalance.credits.used,
      );
      const anonymousState = await polychatApi.getAnonymousUsageState(firstCompletionId);

      expect(anonymousState.credit_period).toBe(new Date().toISOString().slice(0, 7));
      expect(anonymousState.spent_credit_micros).toBeGreaterThan(0);
      expect(anonymousState.reserved_credit_micros).toBe(0);
      expect(anonymousState.event_count).toBe(0);

      const parallelStatuses = await Promise.all(
        Array.from({ length: 3 }, () =>
          polychatApi.completionStatus({
            ...firstTurn.request,
            completion_id: crypto.randomUUID(),
            messages: Array.isArray(firstTurn.request.messages)
              ? firstTurn.request.messages.map((message) =>
                  message && typeof message === "object"
                    ? { ...message, id: crypto.randomUUID() }
                    : message,
                )
              : firstTurn.request.messages,
          }),
        ),
      );

      expect(parallelStatuses).toEqual([200, 200, 200]);
      expect(
        (await polychatApi.getAnonymousUsageState(firstCompletionId)).spent_credit_micros,
      ).toBe(anonymousState.spent_credit_micros + firstAnonymousState.spent_credit_micros * 3);

      const previousMonth = new Date();

      previousMonth.setUTCMonth(previousMonth.getUTCMonth() - 1);
      await billingState.set({
        period: previousMonth.toISOString().slice(0, 7),
        spentCredits: 20,
      });
      await homePage.startNewChat();
      await homePage.selectModel(MODEL);
      await homePage.sendMessage("Start the anonymous allowance in a new month");
      await homePage.waitForChatResponse(0);
      const rolledBalance = await polychatApi.getAccountUsageBalance();

      expect(rolledBalance.period).toBe(new Date().toISOString().slice(0, 7));
      expect(rolledBalance.credits.used).toBeGreaterThan(0);
      expect(rolledBalance.credits.used).toBeLessThan(20);

      await billingState.set({ spentCredits: 22.5 });
      expect(await polychatApi.speechStatus()).toBe(429);
      await homePage.startNewChat();
      await homePage.selectModel(MODEL);
      await homePage.sendMessage("Refuse anonymous usage beyond the reserve");
      await expect(page.getByText(/This month's credits are fully spent/).first()).toBeVisible();
      await expect(page.getByText("E2E response:")).toHaveCount(0);
    });
  });

  test.describe("free account", () => {
    test.use({
      persona: "free",
      billing: { spentCredits: 200, ledger: FREE_LEDGER },
    });

    test("stops at the ceiling with no reserve and no overage", async ({
      billingPage,
      homePage,
      page,
    }) => {
      await billingPage.open();
      expect(await billingPage.creditsAllowance()).toBe(
        "200 of 150 included credits used, 0 of reserve remaining",
      );
      await expect(billingPage.creditState).toHaveText("Out of credits");
      await expect(billingPage.creditsFigure("Reserve remaining")).toHaveText("0");
      await expect(billingPage.overageToggle).toHaveCount(0);

      await expect(billingPage.spendSummaryTotals).toHaveText("200 credits · 3 events");
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

    test("rejects foreign Checkout redirects and creates a configured Pro session", async ({
      polychatApi,
    }) => {
      expect(
        await polychatApi.checkoutStatus({
          planId: "pro",
          successUrl: "https://localhost.evil.example/success",
          cancelUrl: "http://localhost:5173/pricing",
        }),
      ).toBe(400);

      await expect(
        polychatApi.createCheckoutSession({
          planId: "pro",
          successUrl: "http://localhost:5173/profile?tab=billing",
          cancelUrl: "http://localhost:5173/pricing",
        }),
      ).resolves.toEqual({
        session_id: "cs_e2e_pro",
        url: "https://checkout.stripe.com/c/pay/cs_e2e_pro",
      });
    });
  });

  test.describe("pro account", () => {
    test.use({
      persona: "pro",
      billing: { spentCredits: 420, subscribed: true, ledger: PRO_LEDGER },
    });

    test("paginates an isolated ledger and identifies model work on the user's key", async ({
      billingPage,
      billingState,
      browser,
      page,
      polychatApi,
    }, testInfo) => {
      await billingState.set({
        spentCredits: 26,
        subscribed: true,
        ledger: PAGINATED_LEDGER,
      });

      const firstPage = await polychatApi.getAccountUsageEvents({ limit: 25 });

      expect(firstPage.events).toHaveLength(25);
      expect(firstPage.next_cursor).not.toBeNull();
      const secondPage = await polychatApi.getAccountUsageEvents({
        cursor: firstPage.next_cursor ?? undefined,
        limit: 25,
      });

      expect(secondPage.events).toHaveLength(2);
      expect(secondPage.next_cursor).toBeNull();

      const byokEvent = firstPage.events.find(({ byok }) => byok);

      expect(byokEvent).toMatchObject({
        billable: false,
        credit_micros: 0,
        credits: 0,
      });
      expect(byokEvent?.cost_micros).toBeGreaterThan(0);
      const balance = await polychatApi.getAccountUsageBalance();

      expect(balance.credits.used).toBe(26);
      expect(balance.period).toBe(new Date().toISOString().slice(0, 7));
      const accountSummary = await polychatApi.getAccountUsageSummary();

      expect(accountSummary.totals.credits).toBe(26);
      expect(accountSummary.totals.event_count).toBeGreaterThanOrEqual(27);

      const otherUser = await provisionPersonaSession(
        "pro",
        `${testInfo.testId}:ledger-outsider:${testInfo.retry}`,
      );
      const otherContext = await browser.newContext();

      try {
        await otherContext.addCookies([
          {
            name: "session",
            value: otherUser.sessionToken,
            domain: "localhost",
            path: "/",
            httpOnly: true,
            sameSite: "Lax",
            secure: false,
          },
        ]);
        expect(
          (await new PolychatApi(otherContext.request).getAccountUsageEvents()).events,
        ).toEqual([]);
      } finally {
        await otherContext.close();
      }

      const renderedSummaryResponse = page.waitForResponse(
        (response) =>
          response.request().method() === "GET" &&
          new URL(response.url()).pathname.endsWith("/user/usage/summary"),
      );

      await billingPage.open();
      const renderedSummary = usageSummaryResponseSchema.parse(
        await (await renderedSummaryResponse).json(),
      );

      await expect(billingPage.spendSummaryTotals).toHaveText(
        `${formatCredits(renderedSummary.totals.credits)} credits · ${renderedSummary.totals.event_count} events`,
      );
      await expect(billingPage.ledgerRows()).toHaveCount(25);
      await expect(billingPage.ledgerRows().filter({ hasText: "your key" })).toHaveCount(1);
      await billingPage.showMoreLedgerEntries();
      await expect.poll(() => billingPage.ledgerRows().count()).toBeGreaterThanOrEqual(27);
      await expect(billingPage.ledgerCard.getByRole("button", { name: "Show more" })).toHaveCount(
        0,
      );
    });

    test("removes the legacy daily-message promise from every account surface", async ({
      appPage,
      billingPage,
      homePage,
      page,
      pricingPage,
      profilePage,
    }) => {
      await homePage.navigate("/chat");
      await appPage.openSettings("Pro");
      await expect(page.getByText(/messages a day/i)).toHaveCount(0);

      await profilePage.openAccount();
      await expect(page.getByText(/messages a day/i)).toHaveCount(0);

      await billingPage.open();
      await expect(page.getByText(/messages a day/i)).toHaveCount(0);

      await pricingPage.open();
      await expect(page.getByText(/messages a day/i)).toHaveCount(0);
    });

    test("rejects foreign portal returns and preserves an allowed billing return", async ({
      polychatApi,
    }) => {
      expect(
        await polychatApi.billingPortalStatus("https://localhost.evil.example/profile?tab=billing"),
      ).toBe(400);
      await expect(
        polychatApi.createBillingPortalSession("http://localhost:5173/profile?tab=billing"),
      ).resolves.toEqual({ url: "https://billing.stripe.com/p/session/bps_e2e_pro" });
    });

    test("carries a Pro account from on track through its reserve to a pause", async ({
      billingPage,
      billingState,
      homePage,
      page,
    }) => {
      await billingPage.open();
      expect(await billingPage.creditsAllowance()).toBe(
        "420 of 1,500 included credits used, 1,230 of reserve remaining",
      );
      await expect(billingPage.creditState).toHaveText("On track");
      await expect(billingPage.creditsFigure("Reserve")).toHaveText("150");
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

      await billingState.set({ spentCredits: 1510, subscribed: true, ledger: PRO_LEDGER });
      await billingPage.open();
      expect(await billingPage.creditsAllowance()).toBe(
        "1,510 of 1,500 included credits used, 140 of reserve remaining",
      );
      await expect(billingPage.creditState).toHaveText("In reserve");
      await expect(billingPage.creditsFigure("Reserve remaining")).toHaveText("140");

      await homePage.navigate("/chat");
      await homePage.selectModel(MODEL);
      await homePage.sendMessage("Pro release turn inside the reserve");
      await homePage.waitForChatResponse(0);
      await expect(homePage.getLatestAssistantMessage()).toContainText("E2E response:");
      await expect(homePage.composerBanner("into your reserve")).toBeVisible();
      await expect(page.getByText(/This month's credits are fully spent/)).toHaveCount(0);

      await billingState.set({ spentCredits: 1650, subscribed: true, ledger: PRO_LEDGER });
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
        spentCredits: 1660,
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
