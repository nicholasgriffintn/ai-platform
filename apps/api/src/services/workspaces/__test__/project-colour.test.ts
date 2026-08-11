import { createProjectSchema, deriveProjectColour } from "@assistant/schemas";
import { describe, expect, it } from "vitest";

describe("project colours", () => {
	it("derives stable, varied colours from the project identity", () => {
		const launchColour = deriveProjectColour("Launch plan", "Prepare the public release");

		expect(deriveProjectColour("  LAUNCH   PLAN ", " Prepare the public release ")).toBe(
			launchColour,
		);
		expect(deriveProjectColour("Research", "Summarise customer interviews")).not.toBe(launchColour);
		expect(launchColour).toMatch(/^#[0-9A-F]{6}$/);
	});

	it("allows project colour to be derived when it is omitted from a request", () => {
		expect(createProjectSchema.parse({ name: "Project" })).toEqual({
			name: "Project",
			description: "",
			instructions: "",
		});
	});
});
