import { describe, expect, it } from "vitest";

import { readNumericField } from "../recordFields";

describe("readNumericField", () => {
	it("normalises numeric edge metadata and rejects unusable values", () => {
		expect(readNumericField({ longitude: "-0.1276" }, "longitude")).toBe(-0.1276);
		expect(readNumericField({ latitude: 51.5072 }, "latitude")).toBe(51.5072);
		expect(readNumericField({ latitude: "" }, "latitude")).toBeUndefined();
		expect(readNumericField({ latitude: "north" }, "latitude")).toBeUndefined();
	});
});
