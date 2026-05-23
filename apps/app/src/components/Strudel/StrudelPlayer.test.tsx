import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { StrudelPlayer } from "./StrudelPlayer";

describe("StrudelPlayer", () => {
	it("renders on the server without evaluating Strudel browser packages", () => {
		expect(() => renderToString(<StrudelPlayer code={'s("bd sd")'} />)).not.toThrow();
	});
});
