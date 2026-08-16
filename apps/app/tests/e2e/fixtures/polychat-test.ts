import { test as base, expect } from "@playwright/test";
import { createHash } from "node:crypto";

import { AppPage, AuthPage, HomePage, ProfilePage, WorkPage } from "../page-objects";
import { ExternalServices } from "./external-services";

export type Persona = "logged-out" | "free" | "pro";
type AuthenticatedPersona = Exclude<Persona, "logged-out">;

async function provisionLoggedOutPersona(seed: string) {
	const identity = createHash("sha256").update(seed).digest("hex");
	const response = await fetch("http://localhost:8787/__e2e-persona", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ identity, persona: "logged-out" }),
	});
	if (!response.ok) {
		throw new Error(`E2E persona setup failed with ${response.status}: ${await response.text()}`);
	}
	return identity.slice(0, 36);
}

export async function provisionPersonaSession(persona: AuthenticatedPersona, seed: string) {
	const identity = createHash("sha256").update(seed).digest("hex");
	const sessionToken = `polychat-e2e-${persona}-${identity}`;
	const response = await fetch("http://localhost:8787/__e2e-persona", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ identity, persona, sessionToken }),
	});
	if (!response.ok) {
		throw new Error(`E2E persona setup failed with ${response.status}: ${await response.text()}`);
	}
	return {
		email: `${persona}-${identity}@e2e.polychat.invalid`,
		sessionToken,
	};
}

interface PolychatFixtures {
	persona: Persona;
	appPage: AppPage;
	authPage: AuthPage;
	externalServices: ExternalServices;
	homePage: HomePage;
	profilePage: ProfilePage;
	workPage: WorkPage;
}

export const test = base.extend<PolychatFixtures>({
	persona: ["logged-out", { option: true }],
	page: async ({ page, persona }, use, testInfo) => {
		if (persona === "logged-out") {
			const anonymousId = await provisionLoggedOutPersona(
				`${testInfo.testId}:${testInfo.retry}:${testInfo.workerIndex}`,
			);
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
			const { sessionToken } = await provisionPersonaSession(
				persona,
				`${testInfo.testId}:${testInfo.retry}:${testInfo.workerIndex}`,
			);
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
	appPage: async ({ page }, use) => use(new AppPage(page)),
	authPage: async ({ page }, use) => use(new AuthPage(page)),
	externalServices: async ({ page }, use) => use(new ExternalServices(page)),
	homePage: async ({ page }, use) => use(new HomePage(page)),
	profilePage: async ({ page }, use) => use(new ProfilePage(page)),
	workPage: async ({ page }, use) => use(new WorkPage(page)),
});

export { expect };
