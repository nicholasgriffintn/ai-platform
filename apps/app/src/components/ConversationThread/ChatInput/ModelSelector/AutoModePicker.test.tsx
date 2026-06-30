import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ModelConfigItem } from "@assistant/schemas";
import { AutoModePicker } from "./AutoModePicker";

const makeModel = (id: string, overrides: Partial<ModelConfigItem> = {}): ModelConfigItem => ({
	id,
	name: id,
	matchingModel: id,
	provider: "test",
	modalities: { input: ["text"], output: ["text"] },
	contextComplexity: 3,
	reliability: 4,
	speed: 3,
	...overrides,
});

describe("AutoModePicker", () => {
	it("selects an automatic router mode", () => {
		const onSelectMode = vi.fn();

		render(
			<AutoModePicker
				models={[makeModel("fast", { speed: 5, contextComplexity: 3 })]}
				selectedMode="auto"
				onSelectMode={onSelectMode}
			/>,
		);

		fireEvent.click(screen.getByRole("option", { name: "Lite automatic mode" }));

		expect(onSelectMode).toHaveBeenCalledWith("lite");
	});

	it("marks the selected automatic mode", () => {
		render(<AutoModePicker models={[]} selectedMode="pro" onSelectMode={vi.fn()} />);

		expect(screen.getByRole("option", { name: "Pro automatic mode" })).toHaveAttribute(
			"aria-selected",
			"true",
		);
	});

	it("disables automatic modes with no candidates", () => {
		const onSelectMode = vi.fn();

		render(
			<AutoModePicker
				models={[makeModel("fast", { speed: 5, contextComplexity: 3 })]}
				selectedMode="auto"
				onSelectMode={onSelectMode}
			/>,
		);

		const maxOption = screen.getByRole("option", { name: "Max automatic mode" });

		expect(maxOption).toBeDisabled();
		fireEvent.click(maxOption);
		expect(onSelectMode).not.toHaveBeenCalledWith("max");
	});

	it("keeps automatic modes enabled when candidates exist", () => {
		render(
			<AutoModePicker
				models={[
					makeModel("max", {
						contextComplexity: 5,
						reliability: 5,
						artificialAnalysis: { intelligenceIndex: 45 },
					}),
				]}
				selectedMode="max"
				onSelectMode={vi.fn()}
			/>,
		);

		expect(screen.getByRole("option", { name: "Max automatic mode" })).not.toBeDisabled();
	});

	it("shows candidate counts from router metadata", () => {
		render(
			<AutoModePicker
				models={[
					makeModel("lite-1", { name: "Lite One", speed: 5, contextComplexity: 3 }),
					makeModel("lite-2", { name: "Lite Two", speed: 5, reliability: 5, contextComplexity: 4 }),
					makeModel("lite-3", {
						name: "Lite Three",
						speed: 4,
						reliability: 5,
						contextComplexity: 4,
					}),
					makeModel("lite-4", {
						name: "Lite Four",
						speed: 4,
						reliability: 1,
						contextComplexity: 4,
					}),
					makeModel("slow", { speed: 2, contextComplexity: 3 }),
				]}
				selectedMode="lite"
				onSelectMode={vi.fn()}
			/>,
		);

		expect(screen.getByText("4 candidates")).toBeInTheDocument();
		expect(screen.queryByText("Example models")).not.toBeInTheDocument();
		expect(screen.getByText("Lite One")).toBeInTheDocument();
		expect(screen.getByText("Lite Two")).toBeInTheDocument();
		expect(screen.getByText("Lite Three")).toBeInTheDocument();
		expect(screen.queryByText("Lite Four")).not.toBeInTheDocument();
		expect(screen.getByText("+1 more...")).toBeInTheDocument();
	});
});
