import { describe, expect, it } from "vitest";

import { sanitizeStrudelCode } from "./strudel";

describe("sanitizeStrudelCode", () => {
	it("removes markdown fences and statement separators", () => {
		expect(sanitizeStrudelCode('```strudel\ns("bd sd");\n```')).toBe('s("bd sd")');
	});

	it("keeps supported Strudel notation inside quoted patterns", () => {
		expect(sanitizeStrudelCode('s("bd*2 [~ sd] <hh cp>").gain(0.8)')).toBe(
			's("bd*2 [~ sd] <hh cp>").gain(0.8)',
		);
	});

	it("strips unsupported characters from quoted sample patterns", () => {
		expect(sanitizeStrudelCode('s("bd 💥 sd")')).toBe('s("bd  sd")');
	});
});
