import { test as base, expect } from "@playwright/test";

import {
  AppPage,
  AuthPage,
  BillingPage,
  CapabilitiesPage,
  HomePage,
  PricingPage,
  ProfilePage,
  WorkPage,
} from "../page-objects";
import { ExternalServices } from "./external-services";
import type { BillingSeed, Persona } from "./persona-provisioning";
import {
  provisionLoggedOutPersona,
  provisionPersonaSession,
  reseedPersonaBilling,
} from "./persona-provisioning";

export type { BillingSeed, Persona, UsageLedgerSeed } from "./persona-provisioning";
export { provisionPersonaSession } from "./persona-provisioning";

export interface BillingStateControl {
  set(billing: BillingSeed): Promise<void>;
}

interface PolychatFixtures {
  persona: Persona;
  billing: BillingSeed | null;
  billingState: BillingStateControl;
  appPage: AppPage;
  authPage: AuthPage;
  billingPage: BillingPage;
  capabilitiesPage: CapabilitiesPage;
  externalServices: ExternalServices;
  homePage: HomePage;
  pricingPage: PricingPage;
  profilePage: ProfilePage;
  workPage: WorkPage;
}

function identitySeed(testInfo: { testId: string; retry: number; workerIndex: number }) {
  return `${testInfo.testId}:${testInfo.retry}:${testInfo.workerIndex}`;
}

export const test = base.extend<PolychatFixtures>({
  persona: ["logged-out", { option: true }],
  billing: [null, { option: true }],
  page: async ({ page, persona, billing }, use, testInfo) => {
    const seed = identitySeed(testInfo);

    if (persona === "logged-out") {
      const anonymousId = await provisionLoggedOutPersona(seed, billing ?? undefined);

      await page.context().addCookies([
        {
          name: "anon_id",
          value: anonymousId,
          domain: "localhost",
          path: "/",
          httpOnly: true,
          sameSite: "Lax",
          secure: false,
        },
      ]);
    } else {
      const { sessionToken } = await provisionPersonaSession(persona, seed, billing ?? undefined);

      await page.context().addCookies([
        {
          name: "session",
          value: sessionToken,
          domain: "localhost",
          path: "/",
          httpOnly: true,
          sameSite: "Lax",
          secure: false,
        },
      ]);
    }

    await use(page);
  },
  billingState: async ({ persona }, use, testInfo) => {
    const seed = identitySeed(testInfo);

    await use({
      set: (next: BillingSeed) => reseedPersonaBilling(persona, seed, next),
    });
  },
  appPage: async ({ page }, use) => use(new AppPage(page)),
  authPage: async ({ page }, use) => use(new AuthPage(page)),
  billingPage: async ({ page }, use) => use(new BillingPage(page)),
  capabilitiesPage: async ({ page }, use) => use(new CapabilitiesPage(page)),
  externalServices: async ({ page }, use) => use(new ExternalServices(page)),
  homePage: async ({ page }, use) => use(new HomePage(page)),
  pricingPage: async ({ page }, use) => use(new PricingPage(page)),
  profilePage: async ({ page }, use) => use(new ProfilePage(page)),
  workPage: async ({ page }, use) => use(new WorkPage(page)),
});

export { expect };
