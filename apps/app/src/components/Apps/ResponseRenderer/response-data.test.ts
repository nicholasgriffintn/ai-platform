import { describe, expect, it } from "vitest";

import { resolveResponseData } from "./response-data";

// A stored output keeps the whole execution envelope: the submitted form values alongside
// the tool's own result. Unwrapping it needs the producing tool, which owns the display.
const storedOutput = {
	formData: { location: "Sheffield" },
	result: { content: "Cloudy, 11°C" },
};

describe("resolveResponseData", () => {
	it("unwraps a stored output to the tool result when the producing tool is known", () => {
		expect(resolveResponseData(storedOutput, { hasAppSchema: true })).toEqual({
			content: "Cloudy, 11°C",
		});
	});

	it("returns the whole envelope when the producing tool is unknown", () => {
		expect(resolveResponseData(storedOutput, { hasAppSchema: false })).toEqual(storedOutput);
	});
});
