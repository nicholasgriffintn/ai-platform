import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { Drawing } from "~/types/drawing";
import { DrawingView } from "./DrawingView";

const drawing: Drawing = {
	id: "drawing-123456",
	description: "Private drawing",
	drawingUrl: "http://localhost:8787/assets/original-asset",
	paintingUrl: "http://localhost:8787/assets/painting-asset",
	createdAt: "2026-06-03T20:32:15.000Z",
	updatedAt: "2026-06-03T20:32:23.000Z",
};

describe("DrawingView", () => {
	it("renders private drawing images with credentials", () => {
		render(<DrawingView drawing={drawing} />);

		expect(screen.getByAltText("Private drawing")).toHaveAttribute(
			"crossorigin",
			"use-credentials",
		);
	});
});
