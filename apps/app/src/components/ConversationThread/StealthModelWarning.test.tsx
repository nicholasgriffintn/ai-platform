import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ModelConfigItem } from "@assistant/schemas";
import { StealthModelWarning } from "./StealthModelWarning";

describe("StealthModelWarning", () => {
	it("shows the provider logging note for alpha status models", () => {
		render(
			<StealthModelWarning
				model={
					{
						id: "openrouter/owl-alpha",
						name: "Owl Alpha",
						matchingModel: "openrouter/owl-alpha",
						provider: "openrouter",
						status: "alpha",
					} as ModelConfigItem
				}
			/>,
		);

		expect(
			screen.getByText(
				"Note: Prompts and completions may be logged by the provider and used to improve the model.",
			),
		).toBeInTheDocument();
	});

	it("does not show the note for non-stealth models", () => {
		render(
			<StealthModelWarning
				model={
					{
						id: "provider/beta",
						name: "Beta Model",
						matchingModel: "provider/beta",
						provider: "provider",
						status: "beta",
					} as ModelConfigItem
				}
			/>,
		);

		expect(screen.queryByText(/^Note:/)).not.toBeInTheDocument();
	});
});
