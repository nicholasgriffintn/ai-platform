import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AssistantRecipe, RecipeInstallation } from "@ngriffin_uk/polychat-schemas";

import { RecipeEventTriggersDialog } from "./RecipeEventTriggersDialog";

const recipe = {
	id: "code-watch",
	title: "Code watch",
	summary: "Respond to repository activity",
	description: "Runs when a connected repository changes.",
	kind: "automate",
	category: "Developer",
	featured: false,
	estimatedSetupMinutes: 2,
	integrations: [
		{
			id: "github",
			providerId: "github",
			name: "GitHub",
			description: "GitHub",
			connectionStatus: "connected",
			requiresConnection: true,
		},
	],
	triggers: [{ type: "event", label: "Repository event", description: "Run on changes" }],
	actions: ["Summarise the change"],
	setupPrompt: "Configure code watch",
	enabledTools: ["use_recipe_connector"],
	configurationFields: [],
} satisfies AssistantRecipe;

const installation = {
	id: "installation-1",
	recipeId: recipe.id,
	userId: 42,
	projectId: "project-1",
	status: "active",
	triggers: [{ type: "manual", enabled: true }],
	configuration: {},
	createdAt: "2026-08-13T09:00:00.000Z",
	updatedAt: "2026-08-13T09:00:00.000Z",
} satisfies RecipeInstallation;

function wrapper({ children }: { children: ReactNode }) {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
	});
	return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe("RecipeEventTriggersDialog", () => {
	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	it("creates a live event trigger with an explicitly selected named account", async () => {
		const requests: Array<{ url: string; method: string; body?: unknown }> = [];
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
				const url = String(input);
				const method = init?.method ?? "GET";
				requests.push({
					url,
					method,
					...(init?.body ? { body: JSON.parse(String(init.body)) } : {}),
				});
				if (url.includes("/apps/connectors/github/accounts")) {
					return Response.json({
						accounts: [
							{
								id: "account-secret-id",
								providerId: "github",
								alias: "Work GitHub",
								status: "ACTIVE",
								isDisabled: false,
								isSelected: true,
								connectedAt: "2026-08-01T10:00:00.000Z",
								updatedAt: "2026-08-12T10:00:00.000Z",
							},
						],
					});
				}
				if (url.includes("composio-trigger-types")) {
					return Response.json({
						triggerTypes: [
							{
								slug: "GITHUB_COMMIT_EVENT",
								name: "New commit",
								description: "Run when a commit lands.",
								kind: "webhook",
								configuration: {
									type: "object",
									required: ["branch"],
									properties: {
										branch: { type: "string", title: "Branch" },
									},
								},
							},
						],
					});
				}
				if (url.includes("composio-triggers") && method === "POST") {
					return Response.json({
						id: "trigger-secret-id",
						installationId: installation.id,
						projectId: installation.projectId,
						providerId: "github",
						triggerSlug: "GITHUB_COMMIT_EVENT",
						externalTriggerId: "external-secret-id",
						connectedAccountId: "account-secret-id",
						configuration: { branch: "main" },
						status: "active",
						lastError: null,
						createdAt: "2026-08-13T10:00:00.000Z",
						updatedAt: null,
					});
				}
				return Response.json({ triggers: [] });
			}),
		);

		render(
			<RecipeEventTriggersDialog
				recipe={recipe}
				installation={installation}
				providers={[{ id: "github", name: "GitHub" }]}
				onClose={vi.fn()}
			/>,
			{ wrapper },
		);

		expect(await screen.findByText("No event triggers yet.")).toBeInTheDocument();
		expect(await screen.findByRole("option", { name: "Work GitHub" })).toBeInTheDocument();
		expect(screen.queryByText("account-secret-id")).not.toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Create event trigger" }));
		expect(await screen.findByRole("alert")).toHaveTextContent("Complete Branch.");
		expect(requests.some((request) => request.method === "POST")).toBe(false);
		fireEvent.change(screen.getByLabelText("Branch"), { target: { value: "main" } });
		fireEvent.click(screen.getByRole("button", { name: "Create event trigger" }));

		await waitFor(() =>
			expect(requests).toContainEqual({
				url: expect.stringContaining(
					"/apps/recipes/installations/installation-1/composio-triggers",
				),
				method: "POST",
				body: {
					providerId: "github",
					triggerSlug: "GITHUB_COMMIT_EVENT",
					connectedAccountId: "account-secret-id",
					configuration: { branch: "main" },
				},
			}),
		);
	});

	it("lists a named event and allows it to be paused and deleted", async () => {
		const requests: Array<{ url: string; method: string; body?: unknown }> = [];
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
				const url = String(input);
				const method = init?.method ?? "GET";
				requests.push({
					url,
					method,
					...(init?.body ? { body: JSON.parse(String(init.body)) } : {}),
				});
				if (url.includes("/apps/connectors/github/accounts")) {
					return Response.json({
						accounts: [
							{
								id: "account-secret-id",
								providerId: "github",
								alias: "Work GitHub",
								status: "ACTIVE",
								isDisabled: false,
								isSelected: true,
								connectedAt: "2026-08-01T10:00:00.000Z",
								updatedAt: "2026-08-12T10:00:00.000Z",
							},
						],
					});
				}
				if (url.includes("composio-trigger-types")) {
					return Response.json({
						triggerTypes: [
							{
								slug: "GITHUB_COMMIT_EVENT",
								name: "New commit",
								description: "Run when a commit lands.",
								kind: "webhook",
								configuration: {},
							},
						],
					});
				}
				if (method === "PUT") return Response.json({ id: "trigger-secret-id", status: "paused" });
				if (method === "DELETE") return new Response(null, { status: 204 });
				return Response.json({
					triggers: [
						{
							id: "trigger-secret-id",
							installationId: installation.id,
							projectId: installation.projectId,
							providerId: "github",
							triggerSlug: "GITHUB_COMMIT_EVENT",
							externalTriggerId: "external-secret-id",
							connectedAccountId: "account-secret-id",
							configuration: {},
							status: "active",
							lastError: null,
							createdAt: "2026-08-13T10:00:00.000Z",
							updatedAt: null,
						},
					],
				});
			}),
		);

		render(
			<RecipeEventTriggersDialog
				recipe={recipe}
				installation={installation}
				providers={[{ id: "github", name: "GitHub" }]}
				onClose={vi.fn()}
			/>,
			{ wrapper },
		);

		expect(await screen.findAllByText("New commit")).toHaveLength(2);
		expect(screen.queryByText("trigger-secret-id")).not.toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Pause" }));
		await waitFor(() =>
			expect(requests).toContainEqual({
				url: expect.stringContaining("/apps/recipes/composio-triggers/trigger-secret-id"),
				method: "PUT",
				body: { status: "paused" },
			}),
		);
		fireEvent.click(screen.getByRole("button", { name: "Delete New commit event trigger" }));
		expect(
			await screen.findByRole("heading", { name: "Delete event trigger?" }),
		).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Delete trigger" }));
		await waitFor(() =>
			expect(requests).toContainEqual({
				url: expect.stringContaining("/apps/recipes/composio-triggers/trigger-secret-id"),
				method: "DELETE",
			}),
		);
	});
});
