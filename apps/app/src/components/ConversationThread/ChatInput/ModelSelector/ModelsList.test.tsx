import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ModelConfigItem } from "~/types";
import { ModelsList } from "./ModelsList";

vi.mock("~/hooks/use-track-event", () => ({
	useTrackEvent: () => ({
		trackFeatureUsage: vi.fn(),
	}),
}));

vi.mock("~/components/ModelIcon", () => ({
	ModelIcon: ({ modelName }: { modelName: string }) => <span>{modelName}</span>,
}));

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
	isFree: true,
	...overrides,
});

describe("ModelsList", () => {
	it("shows active search results as provider sections", () => {
		render(
			<ModelsList
				models={[
					makeModel("kimi-k2", "Kimi K2", "deepinfra", { isFeatured: true }),
					makeModel("moonshot-kimi", "Moonshot Kimi K2.6", "moonshot"),
				]}
				featuredModelIds={{
					"kimi-k2": makeModel("kimi-k2", "Kimi K2", "deepinfra", { isFeatured: true }),
				}}
				isPro={true}
				onSelect={vi.fn()}
				isSearchActive={true}
			/>,
		);

		expect(screen.getByRole("heading", { name: "Search results" })).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: /featured/i })).not.toBeInTheDocument();

		const deepinfraSection = screen.getByRole("heading", {
			name: "Deepinfra",
		}).parentElement?.parentElement;
		const moonshotSection = screen.getByRole("heading", {
			name: "Moonshot",
		}).parentElement?.parentElement;

		expect(deepinfraSection).not.toBeNull();
		expect(moonshotSection).not.toBeNull();
		expect(within(deepinfraSection!).getByRole("option", { name: /Kimi K2/i })).toBeInTheDocument();
		expect(
			within(moonshotSection!).getByRole("option", { name: /Moonshot Kimi K2.6/i }),
		).toBeInTheDocument();
	});
});
