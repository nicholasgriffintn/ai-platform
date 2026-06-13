import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProfileProvidersTab } from "./ProfileProvidersTab";

const useUserMock = vi.fn();
const trackEventMock = vi.fn();
const recipeConnectorsMock = vi.fn();
const storeRecipeConnectorApiKeyMock = vi.fn();

vi.mock("~/hooks/useUser", () => ({
	useUser: () => useUserMock(),
}));

vi.mock("~/hooks/use-track-event", () => ({
	useTrackEvent: () => ({ trackEvent: trackEventMock }),
}));

vi.mock("~/hooks/useConnectors", () => ({
	RECIPE_CONNECTORS_QUERY_KEY: ["recipe-connectors"],
	useRecipeConnectors: () => ({
		data: { connectors: recipeConnectorsMock() },
		isLoading: false,
	}),
	useStartRecipeConnector: () => ({
		mutateAsync: vi.fn(),
		isPending: false,
	}),
	useStoreRecipeConnectorApiKey: () => ({
		mutateAsync: storeRecipeConnectorApiKeyMock,
		isPending: false,
	}),
	useDisconnectRecipeConnector: () => ({
		mutateAsync: vi.fn(),
		isPending: false,
	}),
}));

function renderProfileProvidersTab() {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: { retry: false },
			mutations: { retry: false },
		},
	});

	return render(
		<QueryClientProvider client={queryClient}>
			<ProfileProvidersTab />
		</QueryClientProvider>,
	);
}

describe("ProfileProvidersTab", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		recipeConnectorsMock.mockReturnValue([]);
		storeRecipeConnectorApiKeyMock.mockResolvedValue({ success: true });
		useUserMock.mockReturnValue({
			providerSettings: [
				{
					id: "provider-settings-row",
					provider_id: "cartesia",
					name: "Cartesia",
					enabled: true,
					hasApiKey: true,
				},
			],
			isLoadingProviderSettings: false,
			syncProviders: vi.fn(),
			isSyncingProviders: false,
			deleteProviderApiKey: vi.fn().mockResolvedValue(undefined),
			isDeletingProviderApiKey: false,
		});
	});

	it("stores API-key connector credentials from the connector setup modal", async () => {
		recipeConnectorsMock.mockReturnValue([
			{
				id: "posthog",
				name: "PostHog",
				description: "Query PostHog projects and product analytics.",
				authType: "api_key",
				status: "disconnected",
				setupUrl: "/profile?tab=providers&type=connector&connector=posthog",
				credentialLabel: "Personal API key",
				scopes: ["project:read", "query:read"],
				operations: ["list_projects", "query"],
			},
		]);

		renderProfileProvidersTab();

		fireEvent.click(screen.getByLabelText("Connect"));
		expect(screen.getByRole("heading", { name: "Connect PostHog" })).toBeInTheDocument();

		fireEvent.change(screen.getByLabelText("Personal API key"), {
			target: { value: " phx_test_key " },
		});
		fireEvent.click(screen.getByRole("button", { name: "Connect" }));

		await waitFor(() => {
			expect(storeRecipeConnectorApiKeyMock).toHaveBeenCalledWith({
				provider: "posthog",
				apiKey: "phx_test_key",
			});
		});
	});

	it("lets users delete a configured provider", async () => {
		const deleteProviderApiKey = vi.fn().mockResolvedValue(undefined);
		useUserMock.mockReturnValue({
			providerSettings: [
				{
					id: "provider-settings-row",
					provider_id: "cartesia",
					name: "Cartesia",
					enabled: true,
					hasApiKey: true,
				},
			],
			isLoadingProviderSettings: false,
			syncProviders: vi.fn(),
			isSyncingProviders: false,
			deleteProviderApiKey,
			isDeletingProviderApiKey: false,
		});

		renderProfileProvidersTab();

		fireEvent.click(screen.getByLabelText("Delete provider Cartesia"));
		fireEvent.click(screen.getByRole("button", { name: "Delete Provider" }));

		await waitFor(() => {
			expect(deleteProviderApiKey).toHaveBeenCalledWith({ providerId: "cartesia" });
		});
		expect(trackEventMock).toHaveBeenCalledWith(
			expect.objectContaining({
				name: "delete_provider_api_key",
				value: "cartesia",
			}),
		);
	});

	it("does not show a delete action for unconfigured providers", () => {
		useUserMock.mockReturnValue({
			providerSettings: [
				{
					id: "provider-settings-row",
					provider_id: "cartesia",
					name: "Cartesia",
					enabled: false,
				},
			],
			isLoadingProviderSettings: false,
			syncProviders: vi.fn(),
			isSyncingProviders: false,
			deleteProviderApiKey: vi.fn(),
			isDeletingProviderApiKey: false,
		});

		renderProfileProvidersTab();

		expect(screen.queryByLabelText("Delete provider Cartesia")).not.toBeInTheDocument();
		expect(screen.getByLabelText("Add key")).toBeInTheDocument();
	});

	it("prefills saved messaging configuration without requiring stored secrets again", async () => {
		const storeProviderApiKey = vi.fn().mockResolvedValue(undefined);
		useUserMock.mockReturnValue({
			providerSettings: [
				{
					id: "aws-row",
					provider_id: "aws-sms",
					type: "messaging",
					name: "AWS End User Messaging",
					enabled: true,
					hasApiKey: true,
					configurationFields: [
						{
							key: "accessKeyId",
							label: "AWS Access Key ID",
							type: "password",
							required: true,
						},
						{
							key: "secretAccessKey",
							label: "AWS Secret Access Key",
							type: "password",
							required: true,
						},
						{
							key: "region",
							label: "AWS Region",
							type: "text",
							required: true,
						},
						{
							key: "originationIdentity",
							label: "Origination Identity",
							type: "text",
							required: true,
						},
					],
					configurationValues: {
						region: "eu-west-2",
						originationIdentity: "pool-abc123",
					},
				},
			],
			isLoadingProviderSettings: false,
			syncProviders: vi.fn(),
			isSyncingProviders: false,
			deleteProviderApiKey: vi.fn(),
			isDeletingProviderApiKey: false,
			storeProviderApiKey,
			isStoringProviderApiKey: false,
		});

		renderProfileProvidersTab();

		fireEvent.click(screen.getByLabelText("Update configuration"));
		expect(screen.getByLabelText("AWS Region")).toHaveValue("eu-west-2");
		expect(screen.getByLabelText("Origination Identity")).toHaveValue("pool-abc123");
		expect(screen.getByLabelText("AWS Access Key ID")).not.toBeRequired();
		expect(screen.getByLabelText("AWS Secret Access Key")).not.toBeRequired();

		fireEvent.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => {
			expect(storeProviderApiKey).toHaveBeenCalledWith({
				providerId: "aws-sms",
				apiKey: "",
				secretKey: undefined,
				configuration: {
					region: "eu-west-2",
					originationIdentity: "pool-abc123",
				},
			});
		});
	});
});
