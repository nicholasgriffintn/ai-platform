import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IEnv, IUser } from "~/types";
import connectorRoutes from "../apps/connectors";

const verifyComposioConnectorAuthorizationMock = vi.hoisted(() => vi.fn());

vi.mock("~/services/apps/connectors", () => ({
	deleteRecipeConnectorConnection: vi.fn(),
	listRecipeConnectors: vi.fn(),
	startRecipeConnectorAuthorization: vi.fn(),
	storeRecipeConnectorApiKey: vi.fn(),
	verifyComposioConnectorAuthorization: verifyComposioConnectorAuthorizationMock,
}));

const user: IUser = {
	id: 42,
	name: "Connector user",
	avatar_url: null,
	email: "connector@example.com",
	github_username: null,
	company: null,
	site: null,
	location: null,
	bio: null,
	twitter_username: null,
	created_at: "2026-08-12T00:00:00.000Z",
	updated_at: "2026-08-12T00:00:00.000Z",
	setup_at: null,
	terms_accepted_at: null,
	plan_id: "pro",
};

function createApp() {
	const app = new Hono<{ Bindings: IEnv; Variables: { user: IUser } }>();
	app.use("*", async (context, next) => {
		context.set("user", user);
		await next();
	});
	app.route("/apps/connectors", connectorRoutes);
	return app;
}

describe("connector routes", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("accepts the ordinary Connect Link success callback used in local testing", async () => {
		verifyComposioConnectorAuthorizationMock.mockResolvedValue(
			"https://polychat.test/profile?tab=providers&type=connector&connector=googleslides&connected=1",
		);

		const response = await createApp().request(
			"http://localhost:8787/apps/connectors/composio/verify?status=success&connected_account_id=ca_1mUPT1Sxzu_4",
		);

		expect(response.status).toBe(302);
		expect(response.headers.get("Cross-Origin-Opener-Policy")).toBe("unsafe-none");
		expect(verifyComposioConnectorAuthorizationMock).toHaveBeenCalledWith(
			expect.objectContaining({
				userId: 42,
				status: "success",
				connectedAccountId: "ca_1mUPT1Sxzu_4",
			}),
		);
	});

	it("preserves the deployed callback identity-verification path", async () => {
		verifyComposioConnectorAuthorizationMock.mockResolvedValue(
			"https://polychat.test/profile?tab=providers&type=connector&connector=googleslides&connected=1",
		);

		const response = await createApp().request(
			"https://api.polychat.test/apps/connectors/composio/verify?session_uri=single-use-verifier",
		);

		expect(response.status).toBe(302);
		expect(verifyComposioConnectorAuthorizationMock).toHaveBeenCalledWith(
			expect.objectContaining({ userId: 42, sessionUri: "single-use-verifier" }),
		);
	});
});
