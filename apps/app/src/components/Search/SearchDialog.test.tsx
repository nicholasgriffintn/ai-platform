import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SearchDialog } from "./SearchDialog";

const navigateMock = vi.fn();
const trackFeatureUsageMock = vi.fn();
const chatsMock = vi.hoisted(() => ({
	data: [] as Array<{ id: string; title: string }>,
}));

vi.mock("react-router", () => ({
	useNavigate: () => navigateMock,
}));

vi.mock("~/hooks/use-track-event", () => ({
	useTrackEvent: () => ({
		trackFeatureUsage: trackFeatureUsageMock,
	}),
}));

vi.mock("~/hooks/useChat", () => ({
	useChats: () => ({
		data: chatsMock.data,
	}),
}));

describe("SearchDialog", () => {
	beforeEach(() => {
		chatsMock.data = [];
		navigateMock.mockClear();
		trackFeatureUsageMock.mockClear();
	});

	it("keeps keyboard selection on the visible result after the query narrows", () => {
		chatsMock.data = [
			{ id: "chat-alpha", title: "Alpha status update" },
			{ id: "chat-archive", title: "Archived alpha notes" },
			{ id: "chat-beta", title: "Beta planning" },
		];
		const onClose = vi.fn();
		render(<SearchDialog isOpen onClose={onClose} />);

		const searchInput = screen.getByRole("textbox", { name: "Search conversations" });
		fireEvent.change(searchInput, {
			target: { value: "a" },
		});
		fireEvent.keyDown(searchInput, { key: "ArrowDown" });
		fireEvent.keyDown(searchInput, { key: "ArrowDown" });
		fireEvent.change(searchInput, {
			target: { value: "beta" },
		});
		fireEvent.keyDown(searchInput, { key: "Enter" });

		expect(navigateMock).toHaveBeenCalledWith("/");
		expect(onClose).toHaveBeenCalledOnce();
		expect(trackFeatureUsageMock).toHaveBeenCalledWith(
			"search_result_selected",
			expect.objectContaining({
				chat_title: "Beta planning",
				result_position: 1,
				total_results: 1,
			}),
		);
	});

	it("tracks query changes against the new result set", () => {
		chatsMock.data = [
			{ id: "chat-alpha", title: "Alpha status update" },
			{ id: "chat-beta", title: "Beta planning" },
		];
		render(<SearchDialog isOpen onClose={vi.fn()} />);

		fireEvent.change(screen.getByRole("textbox", { name: "Search conversations" }), {
			target: { value: "beta" },
		});

		expect(trackFeatureUsageMock).toHaveBeenCalledWith("search_query_changed", {
			query_length: 4,
			results_count: 1,
		});
	});
});
