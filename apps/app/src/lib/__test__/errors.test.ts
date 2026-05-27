import { describe, expect, it } from "vitest";

import { getErrorMessage } from "../errors";

describe("error helpers", () => {
	it("returns useful messages from unknown errors", () => {
		expect(getErrorMessage(new Error("Failed"), "Fallback")).toBe("Failed");
		expect(getErrorMessage("Failed", "Fallback")).toBe("Failed");
		expect(getErrorMessage("", "Fallback")).toBe("Fallback");
		expect(getErrorMessage(null, "Fallback")).toBe("Fallback");
	});
});
