import { describe, expect, it } from "vitest";

import { createServiceContext } from "../serviceContext";
import type { IEnv } from "~/types";

describe("service context connector run identity", () => {
	it("creates one opaque connector run identity per service context", () => {
		const env = {} as IEnv;
		const first = createServiceContext({ env });
		const second = createServiceContext({ env });

		expect(first.connectorRunId).toMatch(/^connector_run_[0-9A-F-]+$/i);
		expect(second.connectorRunId).not.toBe(first.connectorRunId);
		expect(first.connectorRunId).toBe(first.connectorRunId);
	});

	it("retains an internal connector run identity when rebuilding context", () => {
		const context = createServiceContext({
			env: {} as IEnv,
			connectorRunId: "connector_run_existing",
		});

		expect(context.connectorRunId).toBe("connector_run_existing");
	});
});
