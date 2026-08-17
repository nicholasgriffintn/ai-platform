import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProjectSchedulesCard } from "./ProjectSchedulesCard";

const mocks = vi.hoisted(() => ({
	openScheduleDialog: vi.fn(),
	setScheduleEnabled: vi.fn(),
	stopSchedule: vi.fn(),
}));

vi.mock("~/state/stores/chatStore", () => ({
	useChatStore: (selector: (state: { user: { id: number } }) => unknown) =>
		selector({ user: { id: 42 } }),
}));

vi.mock("~/hooks/useRecipes", () => ({
	useAssistantRecipes: () => ({
		data: {
			recipes: [
				{
					id: "daily-weather",
					title: "Daily Weather",
					setupPrompt: "Prepare a forecast",
					triggers: [{ type: "schedule" }],
					configurationFields: [{ key: "location", label: "Location", type: "text" }],
				},
				{
					id: "morning-briefing",
					title: "Morning Briefing",
					setupPrompt: "Prepare a briefing",
					triggers: [{ type: "schedule" }],
					configurationFields: [],
				},
			],
		},
	}),
	useRecipeInstallations: () => ({
		data: {
			installations: [
				{
					id: "installation-1",
					recipeId: "daily-weather",
					userId: 42,
					status: "active",
					triggers: [
						{ type: "manual", enabled: true },
						{ type: "schedule", enabled: true, cronExpression: "0 9 * * *" },
					],
					configuration: { location: "London" },
				},
				{
					id: "installation-2",
					recipeId: "morning-briefing",
					userId: 7,
					status: "paused",
					triggers: [{ type: "schedule", enabled: true, cronExpression: "30 8 * * 1-5" }],
					configuration: {},
				},
			],
		},
	}),
}));

vi.mock("~/components/Apps/Recipes/useRecipeWorkflows", () => ({
	useRecipeWorkflows: () => ({
		actions: {
			getRecipeCardState: () => ({ isUpdatingInstallation: false }),
			openScheduleDialog: mocks.openScheduleDialog,
			setScheduleEnabled: mocks.setScheduleEnabled,
			stopSchedule: mocks.stopSchedule,
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
	}),
}));

vi.mock("@ngriffin_uk/polychat-component-capabilities", async (importOriginal) => {
	const original =
		await importOriginal<typeof import("@ngriffin_uk/polychat-component-capabilities")>();
	return {
		...original,
		RecipeConfigurationDialog: () => null,
		RecipeScheduleDialog: () => null,
	};
});

const capabilities = [
	{
		id: "capability-1",
		projectId: "project-1",
		kind: "recipe" as const,
		capabilityId: "daily-weather",
		configuration: {},
		createdBy: 42,
		createdAt: "2026-08-11T00:00:00.000Z",
	},
	{
		id: "capability-2",
		projectId: "project-1",
		kind: "recipe" as const,
		capabilityId: "morning-briefing",
		configuration: {},
		createdBy: 7,
		createdAt: "2026-08-11T00:00:00.000Z",
	},
];

const members = [
	{
		userId: 42,
		name: "Nicholas",
		email: "nicholas@example.com",
		avatarUrl: null,
		role: "member" as const,
		joinedAt: "2026-08-01T00:00:00.000Z",
	},
	{
		userId: 7,
		name: "Alex",
		email: "alex@example.com",
		avatarUrl: null,
		role: "member" as const,
		joinedAt: "2026-08-01T00:00:00.000Z",
	},
];

function renderSchedules() {
	return render(
		<ProjectSchedulesCard
			workspaceId="workspace-1"
			projectId="project-1"
			capabilities={capabilities}
			members={members}
		/>,
	);
}

describe("ProjectSchedulesCard", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.setScheduleEnabled.mockResolvedValue(undefined);
		mocks.stopSchedule.mockResolvedValue(undefined);
	});

	it("shows project schedules and limits mutation controls to their creator", () => {
		renderSchedules();

		expect(screen.getByText("Daily Weather")).toBeInTheDocument();
		expect(screen.getByText("Morning Briefing")).toBeInTheDocument();
		expect(screen.getByText(/Nicholas/)).toBeInTheDocument();
		expect(screen.getByText(/Alex/)).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Manage Daily Weather schedule" }),
		).toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "Manage Morning Briefing schedule" }),
		).not.toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "View Daily Weather configuration" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "View Morning Briefing configuration" }),
		).toBeInTheDocument();
	});

	it("shows saved configuration and lets the creator pause or stop the schedule", async () => {
		renderSchedules();

		fireEvent.click(screen.getByRole("button", { name: "View Daily Weather configuration" }));
		expect(screen.getByRole("dialog", { name: "Daily Weather configuration" })).toBeInTheDocument();
		expect(screen.getByText("Location")).toBeInTheDocument();
		expect(screen.getByText("London")).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Done" }));

		fireEvent.click(screen.getByRole("button", { name: "Manage Daily Weather schedule" }));
		fireEvent.click(screen.getByRole("menuitem", { name: "Pause schedule" }));
		expect(mocks.setScheduleEnabled).toHaveBeenCalledWith(
			expect.objectContaining({ id: "installation-1" }),
			false,
		);

		fireEvent.click(screen.getByRole("menuitem", { name: "Stop schedule" }));
		fireEvent.click(screen.getByRole("button", { name: "Stop schedule" }));
		expect(mocks.stopSchedule).toHaveBeenCalledWith(
			expect.objectContaining({ id: "installation-1" }),
		);
	});
});
