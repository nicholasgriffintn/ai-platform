import { test as base, expect } from "@playwright/test";

import { HomePage, WorkPage } from "../page-objects";
import type { BillingSeed, Persona } from "./persona-provisioning";
import { provisionLoggedOutPersona, provisionPersonaSession } from "./persona-provisioning";

interface ReleaseFixtures {
  persona: Persona;
  billing: BillingSeed | null;
  homePage: HomePage;
  workPage: WorkPage;
}

export const test = base.extend<ReleaseFixtures>({
  persona: ["logged-out", { option: true }],
  billing: [null, { option: true }],
  page: async ({ page, persona, billing }, use, testInfo) => {
    const seed = `${testInfo.testId}:${testInfo.retry}:${testInfo.workerIndex}`;
    const cookie =
      persona === "logged-out"
        ? { name: "anon_id", value: await provisionLoggedOutPersona(seed, billing ?? undefined) }
        : {
            name: "session",
            value: (await provisionPersonaSession(persona, seed, billing ?? undefined))
              .sessionToken,
          };

    await page.context().addCookies([
      {
        ...cookie,
        domain: "localhost",
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
        secure: false,
      },
    ]);
    await use(page);
  },
  homePage: async ({ page }, use) => use(new HomePage(page)),
  workPage: async ({ page }, use) => use(new WorkPage(page)),
});

export { expect };
