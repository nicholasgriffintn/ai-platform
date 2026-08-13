import { afterEach, describe, expect, it, vi } from "vitest";

import {
	listRecipeConnectorAccounts,
	resolveConnectorOperationApproval,
	updateRecipeConnectorAccount,
} from "./connectors";

describe("connector accounts api", () => {
	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	it("lists every connected account for a provider", async () => {
		const response = {
			accounts: [
				{
					id: "account_primary",
					providerId: "airtable",
					alias: "Operations",
					status: "ACTIVE",
					isDisabled: false,
					isSelected: true,
					authConfigId: "auth_airtable",
					connectedAt: "2026-08-01T10:00:00.000Z",
					updatedAt: "2026-08-12T10:00:00.000Z",
				},
			],
		};
		const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
			Response.json(response),
		);
		vi.stubGlobal("fetch", fetchMock);

		await expect(listRecipeConnectorAccounts("airtable")).resolves.toEqual(response);
		expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/apps/connectors/airtable/accounts");
		expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: "GET" });
	});

	it("updates an account alias and selection without exposing account credentials", async () => {
		const updatedAccount = {
			id: "account_primary",
			providerId: "airtable",
			alias: "Finance",
			status: "ACTIVE",
			isDisabled: false,
			isSelected: true,
			connectedAt: "2026-08-01T10:00:00.000Z",
			updatedAt: "2026-08-12T10:00:00.000Z",
		};
		const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
			Response.json(updatedAccount),
		);
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			updateRecipeConnectorAccount("airtable", {
				accountId: "account_primary",
				alias: "Finance",
				selected: true,
			}),
		).resolves.toEqual(updatedAccount);
		const [, init] = fetchMock.mock.calls[0] ?? [];
		expect(init).toMatchObject({ method: "PUT" });
		expect(JSON.parse(String(init?.body))).toEqual({
			accountId: "account_primary",
			alias: "Finance",
			selected: true,
		});
	});

	it("resolves an exact connector action approval", async () => {
		const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
			Response.json({ approval: { id: "coa_action", state: "approved" } }),
		);
		vi.stubGlobal("fetch", fetchMock);

		await expect(resolveConnectorOperationApproval("coa_action", "approved")).resolves.toEqual({
			approval: { id: "coa_action", state: "approved" },
		});
		const [input, init] = fetchMock.mock.calls[0] ?? [];
		expect(String(input)).toContain("/apps/connectors/approvals/coa_action");
		expect(init).toMatchObject({ method: "PUT" });
		expect(JSON.parse(String(init?.body))).toEqual({ resolution: "approved" });
	});
});
