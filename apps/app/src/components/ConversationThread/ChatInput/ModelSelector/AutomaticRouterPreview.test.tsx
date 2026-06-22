import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ModelConfigItem } from "@assistant/schemas";
import { AutomaticRouterPreview } from "./AutomaticRouterPreview";

const makeModel = (
	id: string,
	name: string,
	provider: string,
	overrides: Partial<ModelConfigItem> = {},
): ModelConfigItem => ({
	id,
	name,
	matchingModel: id,
	provider,
	modalities: { input: ["text"], output: ["text"] },
	includedInRouter: true,
	isFree: true,
	...overrides,
});

describe("AutomaticRouterPreview", () => {
	it("renders router lanes from the available model catalogue", () => {
		render(
			<AutomaticRouterPreview
				models={[
					makeModel("quick", "Quick Model", "workers-ai", {
						strengths: ["chat"],
						speed: 5,
					}),
					makeModel("reasoner", "Reasoner Model", "openai", {
						strengths: ["reasoning", "analysis"],
					}),
					makeModel("coder", "Coder Model", "anthropic", {
						strengths: ["coding"],
						supportsToolCalls: true,
					}),
					makeModel("vision", "Vision Model", "google-ai-studio", {
						modalities: { input: ["text", "image"], output: ["text"] },
					}),
				]}
				isSelected={true}
				onSelect={vi.fn()}
			/>,
		);

		expect(screen.getByRole("option", { name: /Automatic routing/i })).toHaveAttribute(
			"aria-selected",
			"true",
		);
		expect(screen.getByText("4 models")).toBeInTheDocument();
		expect(screen.getByText("4 available")).toBeInTheDocument();
		expect(screen.queryByText("Decision")).not.toBeInTheDocument();
		expect(screen.getByText("Fast answers")).toBeInTheDocument();
		expect(screen.getByText("Deep reasoning")).toBeInTheDocument();
		expect(screen.getByText("Code and tools")).toBeInTheDocument();
		expect(screen.getByText("Vision and files")).toBeInTheDocument();

		expect(screen.getByText("Coder Model")).toBeInTheDocument();
	});

	it("shows how many matching models are hidden after the first three chips", () => {
		render(
			<AutomaticRouterPreview
				models={[
					makeModel("quick-1", "Quick 1", "workers-ai", { strengths: ["chat"], speed: 5 }),
					makeModel("quick-2", "Quick 2", "openai", { strengths: ["chat"], speed: 5 }),
					makeModel("quick-3", "Quick 3", "anthropic", { strengths: ["chat"], speed: 5 }),
					makeModel("quick-4", "Quick 4", "mistral", { strengths: ["chat"], speed: 5 }),
					makeModel("quick-5", "Quick 5", "xai", { strengths: ["chat"], speed: 5 }),
				]}
				isSelected={true}
				onSelect={vi.fn()}
			/>,
		);

		expect(screen.getByText("+2 more")).toBeInTheDocument();
	});

	it("selects automatic routing from the overview card", () => {
		const onSelect = vi.fn();

		render(
			<AutomaticRouterPreview
				models={[makeModel("quick", "Quick Model", "workers-ai", { strengths: ["chat"] })]}
				isSelected={false}
				onSelect={onSelect}
			/>,
		);

		fireEvent.click(screen.getByRole("option", { name: /Automatic routing/i }));

		expect(onSelect).toHaveBeenCalledOnce();
	});
});
