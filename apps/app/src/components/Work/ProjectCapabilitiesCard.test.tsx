import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ProjectCapability } from "@assistant/schemas";

import { ProjectCapabilitiesCard } from "./ProjectCapabilitiesCard";

function createCapability(index: number): ProjectCapability {
	return {
		id: `capability-${index}`,
		projectId: "project-1",
		kind: "tool",
		capabilityId: `tool-${index}`,
		configuration: {},
		createdBy: 42,
		createdAt: "2026-08-11T00:00:00.000Z",
	};
}

describe("ProjectCapabilitiesCard", () => {
	it("limits the visible capabilities and summarises the remainder", () => {
		render(
			<ProjectCapabilitiesCard
				capabilities={Array.from({ length: 8 }, (_, index) => createCapability(index + 1))}
				capabilityCount={8}
			/>,
		);

		expect(screen.queryByText("6 enabled")).not.toBeInTheDocument();
		const enabledSummary = screen.getByText("8 enabled").parentElement;
		expect(enabledSummary).toContainElement(screen.getByText("tool-1"));
		expect(screen.getByText("tool-1")).toBeInTheDocument();
		expect(screen.getByText("tool-6")).toBeInTheDocument();
		expect(screen.queryByText("tool-7")).not.toBeInTheDocument();
		expect(screen.queryByText("tool-8")).not.toBeInTheDocument();
		expect(screen.getByText("+2 more")).toBeInTheDocument();
	});
});
