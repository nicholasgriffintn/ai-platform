import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ModelPicker, type ModelSummary } from "./index";

afterEach(cleanup);

describe("ModelPicker", () => {
	it("selects available models while keeping unavailable models inert", () => {
		const models: ModelSummary[] = [
			{ id: "fast", name: "Fast", provider: "Polychat" },
			{
				id: "private",
				name: "Private",
				provider: "Polychat",
				disabledReason: "Ask an administrator for access",
			},
		];
		const onSelect = vi.fn();
		render(<ModelPicker models={models} selectedModelId="fast" onSelect={onSelect} />);

		const available = screen.getByRole("button", { name: /Fast/ });
		const unavailable = screen.getByRole("button", { name: /Private/ });
		expect(available.getAttribute("aria-pressed")).toBe("true");
		expect(unavailable.hasAttribute("disabled")).toBe(true);

		fireEvent.click(available);
		fireEvent.click(unavailable);
		expect(onSelect).toHaveBeenCalledOnce();
		expect(onSelect).toHaveBeenCalledWith(models[0]);
	});

	it("renders the host-provided empty state", () => {
		render(<ModelPicker models={[]} emptyMessage="No permitted models." onSelect={vi.fn()} />);
		expect(screen.getByText("No permitted models.")).toBeTruthy();
	});
});
