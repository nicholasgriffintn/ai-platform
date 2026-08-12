import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ProfileProvidersTab } from "./ProfileProvidersTab";

const useUserMock = vi.fn();
const trackEventMock = vi.fn();
const recipeConnectorsMock = vi.fn();
const storeRecipeConnectorApiKeyMock = vi.fn();
const startRecipeConnectorMock = vi.fn();

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
		mutateAsync: startRecipeConnectorMock,
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

function renderProfileProvidersTab(route = "/profile") {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: { retry: false },
			mutations: { retry: false },
		},
	});

	return render(
		<QueryClientProvider client={queryClient}>
			<MemoryRouter initialEntries={[route]}>
				<ProfileProvidersTab />
			</MemoryRouter>
		</QueryClientProvider>,
	);
}

describe("ProfileProvidersTab", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.clearAllMocks();
		recipeConnectorsMock.mockReturnValue([]);
		storeRecipeConnectorApiKeyMock.mockResolvedValue({ success: true });
		startRecipeConnectorMock.mockReturnValue(new Promise(() => undefined));
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

	afterEach(() => {
		window.name = "";
		Object.defineProperty(window, "opener", { configurable: true, value: null });
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
				categories: [{ id: "analytics", name: "Analytics" }],
				toolCount: 2,
				readToolCount: 2,
				writeToolCount: 0,
			},
		]);

		renderProfileProvidersTab();

		fireEvent.click(screen.getByRole("button", { name: /PostHog/ }));
		fireEvent.click(screen.getByRole("button", { name: "Connect" }));
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

	it("searches and navigates across the complete providers catalogue", async () => {
		recipeConnectorsMock.mockReturnValue([
			{
				id: "posthog",
				name: "PostHog",
				description: "Query product analytics.",
				authType: "api_key",
				status: "disconnected",
				scopes: [],
				categories: [{ id: "analytics", name: "Analytics" }],
				toolCount: 2,
				readToolCount: 2,
				writeToolCount: 0,
			},
		]);

		renderProfileProvidersTab();

		fireEvent.change(screen.getByLabelText("Search providers"), {
			target: { value: "analytics" },
		});
		expect(screen.getByText("PostHog")).toBeInTheDocument();
		expect(screen.queryByText("Cartesia")).not.toBeInTheDocument();

		fireEvent.click(screen.getByLabelText("Clear search"));
		fireEvent.mouseDown(screen.getByRole("tab", { name: /Connected/ }), { button: 0 });
		await waitFor(() => {
			expect(screen.getByText("Cartesia")).toBeInTheDocument();
			expect(screen.queryByText("PostHog")).not.toBeInTheDocument();
		});
	});

	it("opens the requested API-key connector from the profile query", async () => {
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
				categories: [{ id: "analytics", name: "Analytics" }],
				toolCount: 2,
				readToolCount: 2,
				writeToolCount: 0,
			},
		]);

		renderProfileProvidersTab("/profile?tab=providers&type=connector&connector=posthog");

		expect(screen.getByRole("heading", { name: "PostHog" })).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Connect" }));
		expect(screen.getByRole("heading", { name: "Connect PostHog" })).toBeInTheDocument();
		expect(screen.getByLabelText("Personal API key")).toBeInTheDocument();
	});

	it("asks for the exact auth config when a toolkit has more than one", async () => {
		vi.spyOn(window, "open").mockReturnValue({
			closed: false,
			close: vi.fn(),
			focus: vi.fn(),
			location: { replace: vi.fn() },
		} as unknown as Window);
		recipeConnectorsMock.mockReturnValue([
			{
				id: "whatsapp",
				name: "WhatsApp",
				description: "Manage WhatsApp Business.",
				authType: "composio",
				status: "disconnected",
				scopes: [],
				categories: [{ id: "communication", name: "Communication" }],
				toolCount: 1,
				readToolCount: 0,
				writeToolCount: 1,
				authConfigs: [
					{
						id: "ac_first",
						name: "WhatsApp primary",
						authScheme: "OAUTH2",
						isManaged: true,
						status: "disconnected",
					},
					{
						id: "ac_second",
						name: "WhatsApp secondary",
						authScheme: "OAUTH2",
						isManaged: true,
						status: "disconnected",
					},
				],
			},
		]);

		renderProfileProvidersTab();
		fireEvent.click(screen.getByRole("button", { name: /WhatsApp/ }));
		fireEvent.click(screen.getByRole("button", { name: "Connect" }));
		expect(screen.getByRole("heading", { name: "Connect WhatsApp" })).toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: /WhatsApp secondary/ }));
		await waitFor(() => {
			expect(startRecipeConnectorMock).toHaveBeenCalledWith({
				provider: "whatsapp",
				authConfigId: "ac_second",
				returnTo: "/profile?tab=providers&type=connector",
			});
		});
	});

	it("waits for Composio setup in a popup and refreshes after its verified callback", async () => {
		const popup = {
			closed: false,
			close: vi.fn(),
			focus: vi.fn(),
			location: { replace: vi.fn() },
		};
		const openMock = vi.spyOn(window, "open").mockImplementation(() => popup as unknown as Window);
		startRecipeConnectorMock.mockResolvedValue({
			authorizationUrl: "https://connect.composio.dev/link/token",
		});
		recipeConnectorsMock.mockReturnValue([
			{
				id: "airtable",
				name: "Airtable",
				description: "Manage Airtable bases.",
				authType: "composio",
				status: "disconnected",
				scopes: [],
				categories: [{ id: "productivity", name: "Productivity" }],
				toolCount: 24,
				readToolCount: 12,
				writeToolCount: 12,
				authConfigs: [
					{
						id: "ac_airtable",
						name: "Airtable",
						authScheme: "OAUTH2",
						isManaged: true,
						status: "disconnected",
					},
				],
			},
		]);

		renderProfileProvidersTab();
		fireEvent.click(screen.getByText("Airtable"));
		fireEvent.click(screen.getByRole("button", { name: "Connect" }));

		await waitFor(() => {
			expect(openMock).toHaveBeenCalledWith(
				"",
				"polychat-connector-auth",
				expect.stringContaining("popup=yes"),
			);
			expect(popup.location.replace).toHaveBeenCalledWith(
				"https://connect.composio.dev/link/token",
			);
		});
		expect(screen.getByText("Waiting for connection in the popup…")).toBeInTheDocument();

		window.dispatchEvent(
			new MessageEvent("message", {
				data: {
					type: "polychat:connector-auth:completed",
					provider: "airtable",
				},
				origin: window.location.origin,
				source: popup as unknown as MessageEventSource,
			}),
		);

		await waitFor(() => {
			expect(popup.close).toHaveBeenCalled();
			expect(screen.queryByText("Waiting for connection in the popup…")).not.toBeInTheDocument();
		});
	});

	it("notifies the providers page and closes after the verified popup callback", async () => {
		const postMessage = vi.fn();
		const close = vi.spyOn(window, "close").mockImplementation(() => undefined);
		window.name = "polychat-connector-auth";
		Object.defineProperty(window, "opener", {
			configurable: true,
			value: { postMessage },
		});
		recipeConnectorsMock.mockReturnValue([
			{
				id: "airtable",
				name: "Airtable",
				description: "Manage Airtable bases.",
				authType: "composio",
				status: "connected",
				scopes: [],
				categories: [{ id: "productivity", name: "Productivity" }],
				toolCount: 24,
				readToolCount: 12,
				writeToolCount: 12,
			},
		]);

		renderProfileProvidersTab(
			"/profile?tab=providers&type=connector&connector=airtable&connected=1",
		);

		await waitFor(() => {
			expect(postMessage).toHaveBeenCalledWith(
				{
					type: "polychat:connector-auth:completed",
					provider: "airtable",
				},
				window.location.origin,
			);
			expect(close).toHaveBeenCalled();
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

		fireEvent.click(screen.getByText("Cartesia"));
		fireEvent.click(screen.getByRole("button", { name: "Remove key" }));
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

		fireEvent.click(screen.getByText("Cartesia"));
		expect(screen.queryByRole("button", { name: "Remove key" })).not.toBeInTheDocument();
		expect(screen.getByRole("heading", { name: "Configure Cartesia" })).toBeInTheDocument();
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

		fireEvent.click(screen.getByText("AWS End User Messaging"));
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
