import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MemorySynthesisPanel } from "./MemorySynthesisPanel";

const mocks = vi.hoisted(() => ({
	triggerSynthesis: vi.fn(async () => ({ task_id: "task-1", status: "pending" })),
}));

vi.mock("~/hooks/useTasks", () => ({
	useMemorySynthesis: () => ({
		synthesis: {
			id: "synthesis-2",
			user_id: 42,
			synthesis_text: "Prefers concise answers and works on developer tools.",
			synthesis_version: 2,
			memory_count: 14,
			created_at: "2026-08-11T12:00:00.000Z",
		},
		history: [
			{
				id: "synthesis-2",
				user_id: 42,
				synthesis_text: "Prefers concise answers and works on developer tools.",
				synthesis_version: 2,
				created_at: "2026-08-11T12:00:00.000Z",
			},
			{
				id: "synthesis-1",
				user_id: 42,
				synthesis_text: "Prefers concise answers.",
				synthesis_version: 1,
				created_at: "2026-08-01T12:00:00.000Z",
			},
		],
		isLoadingSynthesis: false,
		isLoadingHistory: false,
	}),
	useTasks: () => ({
		triggerSynthesisAsync: mocks.triggerSynthesis,
		isTriggeringSynthesis: false,
	}),
}));

describe("MemorySynthesisPanel", () => {
	it("shows the active synthesis, history, and queues a new synthesis", async () => {
		render(<MemorySynthesisPanel />);

		expect(
			screen.getByText("Prefers concise answers and works on developer tools."),
		).toBeInTheDocument();
		expect(screen.getByText("Version 2")).toBeInTheDocument();
		expect(screen.getByText("Prefers concise answers.")).toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: "Generate synthesis" }));

		await waitFor(() =>
			expect(mocks.triggerSynthesis).toHaveBeenCalledWith({ namespace: "global" }),
		);
	});
});
