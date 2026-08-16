import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import type {
	AssistantActionItem,
	AssistantRecipe,
	ProjectExperienceDefinition,
	ModelToolDefinition,
} from "@ngriffin_uk/polychat-schemas";

import { CapabilityCard } from "./CapabilityCard";
import { RecipeCapabilityCard } from "./RecipeCapabilityCard";
import type { useRecipeWorkflows } from "~/components/Apps/Recipes/useRecipeWorkflows";
import { getProjectSurface, PERSONAL_SURFACE } from "~/lib/capability-surfaces";

const notesExperience: ProjectExperienceDefinition = {
	id: "notes",
	runtime: "notes",
	name: "Note Taker",
	description: "Take notes",
	requirement: { kind: "capability", capabilityKind: "app", capabilityId: "featured-note-taker" },
};

const appItem = {
	id: "app:featured-note-taker",
	kind: "app",
	label: "Note Taker",
	description: "Take notes",
	capability: { id: "featured-note-taker", description: "Take notes" },
	searchText: [],
	metadata: { appId: "featured-note-taker", category: "Productivity" },
} as unknown as AssistantActionItem;

const runnableToolItem = {
	id: "tool:get_weather",
	kind: "tool",
	label: "Get Weather",
	description: "Get a forecast",
	capability: { id: "get_weather", description: "Get a forecast" },
	searchText: [],
	metadata: { toolId: "get_weather", toolRunnable: true, category: "Research" },
} as unknown as AssistantActionItem;

const configuredModelToolItem = {
	id: "model_tool:file_search",
	kind: "model_tool",
	label: "File search",
	description: "Search configured vector stores",
	capability: { id: "file_search", description: "Search configured vector stores" },
	searchText: [],
	metadata: { toolId: "file_search", category: "Knowledge" },
} as unknown as AssistantActionItem;

const alwaysOnSkillItem = {
	id: "skill:recipes",
	kind: "skill",
	label: "Recipes",
	description: "Use saved recipes and connected services",
	capability: {
		id: "recipes",
		description: "Use saved recipes and connected services",
		savedState: { supported: false },
	},
	searchText: [],
} as unknown as AssistantActionItem;

const fileSearchTool: ModelToolDefinition = {
	id: "file_search",
	capability: "supportsFileSearch",
	category: "Knowledge",
	command: "file search",
	description: "Search configured vector stores",
	label: "File search",
	requiresConfiguration: true,
	configurationKind: "file_search",
};

const recipe = {
	id: "daily-briefing",
	title: "Daily Briefing",
	summary: "Summarise the day",
	description: "Build a daily summary",
	kind: "automate",
	category: "Productivity",
	featured: true,
	integrations: [],
	triggers: [],
	actions: ["Summarise"],
	setupPrompt: "Set up a daily briefing",
	enabledTools: [],
	configurationFields: [],
} satisfies AssistantRecipe;

function createRecipeWorkflows() {
	return {
		connectorSetup: {
			authConfigDialog: { connector: null, configs: [] },
			apiKeyDialog: { open: false, providerId: null, providerName: "" },
			closeApiKeyDialog: vi.fn(),
			closeAuthConfigDialog: vi.fn(),
			connect: vi.fn(async () => undefined),
			connectingProviderId: null,
			isStarting: false,
			onApiKeyStored: vi.fn(async () => undefined),
			selectAuthConfig: vi.fn(),
		},
		configurationDialog: {
			recipe: null,
			installation: null,
			values: {},
			setValues: vi.fn(),
			close: vi.fn(),
			submit: vi.fn(),
			isLoading: false,
		},
		scheduleDialog: {
			recipe: null,
			hasExistingSchedule: false,
			cronExpression: "0 9 * * *",
			prompt: "",
			notifySms: false,
			smsTarget: "",
			setCronExpression: vi.fn(),
			setPrompt: vi.fn(),
			setNotifySms: vi.fn(),
			setSmsTarget: vi.fn(),
			close: vi.fn(),
			submit: vi.fn(),
			isLoading: false,
		},
		deleteDialog: {
			installation: null,
			setInstallation: vi.fn(),
			submit: vi.fn(),
			isLoading: false,
		},
		eventDialog: {
			recipe: null,
			installation: null,
			providers: [],
			close: vi.fn(),
		},
		actions: {
			start: vi.fn(),
			configureProvider: vi.fn(),
			openConfigurationDialog: vi.fn(),
			openScheduleDialog: vi.fn(),
			openEventTriggersDialog: vi.fn(),
			setScheduleEnabled: vi.fn(),
			stopSchedule: vi.fn(),
			toggleInstallationStatus: vi.fn(),
			getRecipeCardState: vi.fn(() => ({
				installation: undefined,
				canManageEventTriggers: false,
				isStarting: false,
				isConfiguring: false,
				isEditingConfiguration: false,
				isScheduling: false,
				isUpdatingInstallation: false,
			})),
		},
	} satisfies ReturnType<typeof useRecipeWorkflows>;
}

function renderCard(props: Record<string, unknown>) {
	return render(
		<MemoryRouter>
			<CapabilityCard experiences={[notesExperience]} {...(props as any)} />
		</MemoryRouter>,
	);
}

describe("CapabilityCard", () => {
	it("opens an experience directly when nothing needs enabling first", () => {
		renderCard({
			item: appItem,
			kind: "app",
			surface: PERSONAL_SURFACE,
		});

		expect(screen.getByRole("button", { name: "Open" })).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "Add to project" })).not.toBeInTheDocument();
	});

	it("runs a runnable tool directly when nothing needs enabling first", () => {
		renderCard({
			item: runnableToolItem,
			kind: "tool",
			surface: PERSONAL_SURFACE,
		});

		expect(screen.getByRole("button", { name: "Run" })).toBeInTheDocument();
	});

	it("shows whether a personal model tool still needs configuration", () => {
		renderCard({
			item: configuredModelToolItem,
			kind: "tool",
			isConfigured: false,
			onConfigure: vi.fn(),
			surface: PERSONAL_SURFACE,
			tool: fileSearchTool,
		});

		expect(screen.getByText("Configuration required")).toBeInTheDocument();
	});

	it("asks a project to attach the capability before it can be opened", () => {
		renderCard({
			item: appItem,
			kind: "app",
			surface: getProjectSurface("w1", "p1"),
			projectActions: {
				canManage: true,
				isAdding: false,
				isRemoving: false,
				onAdd: vi.fn(),
				onRemove: vi.fn(),
			},
		});

		expect(screen.getByRole("button", { name: "Add to project" })).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "Open" })).not.toBeInTheDocument();
	});

	it("does not offer to add an always-on skill to a project", () => {
		renderCard({
			item: alwaysOnSkillItem,
			kind: "skill",
			surface: getProjectSurface("w1", "p1"),
			projectActions: {
				canManage: true,
				isAdding: false,
				isRemoving: false,
				onAdd: vi.fn(),
				onRemove: vi.fn(),
			},
		});

		expect(screen.getByText("Always on")).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "Add to project" })).not.toBeInTheDocument();
	});
});

describe("RecipeCapabilityCard", () => {
	it("starts personal recipe setup through the recipe workflow", () => {
		const workflows = createRecipeWorkflows();
		render(<RecipeCapabilityCard recipe={recipe} workflows={workflows} />);

		expect(screen.getByRole("img", { name: "Status: Not set up" })).toBeInTheDocument();
		expect(screen.queryByText("Not set up")).not.toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Set up" }));

		expect(workflows.actions.start).toHaveBeenCalledWith(recipe, undefined);
	});

	it("collapses supported services into one connection manager", () => {
		const workflows = createRecipeWorkflows();
		const integrations: AssistantRecipe["integrations"] = ["Apollo", "HubSpot", "Stripe"].map(
			(name) => ({
				id: name.toLowerCase(),
				providerId: name.toLowerCase(),
				name,
				description: `${name} integration`,
				requiresConnection: false,
				connectionStatus: "not_required",
			}),
		);
		const connectedRecipe = {
			...recipe,
			integrations,
		} satisfies AssistantRecipe;

		render(<RecipeCapabilityCard recipe={connectedRecipe} workflows={workflows} />);

		expect(screen.getByRole("button", { name: "Connections, 3" })).toHaveTextContent(
			"Connections3",
		);
		expect(screen.queryByText("Apollo")).not.toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: "Connections, 3" }));
		expect(screen.getByRole("dialog", { name: "Daily Briefing connections" })).toBeInTheDocument();
		fireEvent.click(screen.getAllByRole("button", { name: "Connect" })[0]);

		expect(workflows.actions.configureProvider).toHaveBeenCalledWith("apollo", undefined);
	});
});
