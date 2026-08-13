import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { RecipeConnectorAccount } from "@assistant/schemas";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { listRecipeConnectorAccounts, updateRecipeConnectorAccount } from "~/lib/api/connectors";
import { ConnectorAccountsPanel } from "./ConnectorAccountsPanel";

vi.mock("~/lib/api/connectors", () => ({
	listRecipeConnectorAccounts: vi.fn(),
	updateRecipeConnectorAccount: vi.fn(),
}));

function renderPanel() {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: { retry: false },
			mutations: { retry: false },
		},
	});

	return render(
		<QueryClientProvider client={queryClient}>
			<ConnectorAccountsPanel provider="airtable" providerName="Airtable" />
		</QueryClientProvider>,
	);
}

const accounts: RecipeConnectorAccount[] = [
	{
		id: "opaque_account_primary",
		providerId: "airtable" as const,
		alias: "Operations",
		status: "ACTIVE",
		isDisabled: false,
		isSelected: true,
		authConfigId: "auth_airtable",
		connectedAt: "2026-08-01T10:00:00.000Z",
		updatedAt: "2026-08-12T10:00:00.000Z",
	},
	{
		id: "opaque_account_secondary",
		providerId: "airtable" as const,
		alias: null,
		status: "EXPIRED",
		isDisabled: true,
		isSelected: false,
		connectedAt: "2026-08-02T10:00:00.000Z",
		updatedAt: "2026-08-11T10:00:00.000Z",
	},
];

describe("ConnectorAccountsPanel", () => {
	beforeEach(() => {
		vi.mocked(listRecipeConnectorAccounts).mockResolvedValue({ accounts });
		vi.mocked(updateRecipeConnectorAccount).mockImplementation(async (_provider, input) => ({
			...accounts.find((account) => account.id === input.accountId)!,
			alias:
				input.alias === undefined
					? (accounts.find((account) => account.id === input.accountId)?.alias ?? null)
					: input.alias,
			isSelected: input.selected === true,
		}));
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it("shows friendly account identities, selection and expired status", async () => {
		renderPanel();

		expect(await screen.findByText("Operations")).toBeInTheDocument();
		expect(screen.getByText("Airtable account 2")).toBeInTheDocument();
		expect(screen.getByText("Selected")).toBeInTheDocument();
		expect(screen.getByText("Needs reconnection")).toBeInTheDocument();
		expect(screen.queryByText("opaque_account_primary")).not.toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Use Airtable account 2" })).toBeDisabled();
	});

	it("saves a trimmed alias through an accessible inline editor", async () => {
		renderPanel();
		await screen.findByText("Operations");

		fireEvent.click(screen.getByRole("button", { name: "Rename Operations" }));
		fireEvent.change(screen.getByLabelText("Account name"), {
			target: { value: "  Finance  " },
		});
		fireEvent.click(screen.getByRole("button", { name: "Save account name" }));

		await waitFor(() => {
			expect(updateRecipeConnectorAccount).toHaveBeenCalledWith("airtable", {
				accountId: "opaque_account_primary",
				alias: "Finance",
			});
		});
	});

	it("selects an active account explicitly", async () => {
		vi.mocked(listRecipeConnectorAccounts).mockResolvedValue({
			accounts: [
				accounts[0]!,
				{
					...accounts[1]!,
					status: "ACTIVE",
					isDisabled: false,
				},
			],
		});
		renderPanel();
		await screen.findByText("Airtable account 2");

		fireEvent.click(screen.getByRole("button", { name: "Use Airtable account 2" }));

		await waitFor(() => {
			expect(updateRecipeConnectorAccount).toHaveBeenCalledWith("airtable", {
				accountId: "opaque_account_secondary",
				selected: true,
			});
		});
	});

	it("keeps the modal actionable when accounts cannot be loaded", async () => {
		vi.mocked(listRecipeConnectorAccounts).mockRejectedValue(new Error("offline"));
		renderPanel();

		expect(await screen.findByText("Accounts unavailable")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
	});
});
