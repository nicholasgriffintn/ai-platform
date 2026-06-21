import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Analytics } from "./Analytics";

describe("Analytics", () => {
	beforeEach(() => {
		document.head.innerHTML = "";
		window.__BEACON_INITALISED__ = undefined;
		window.__OPEN_FEATURE_INITALISED__ = undefined;
		window.Beacon = { init: vi.fn() } as any;
		window.BeaconOpenFeature = { init: vi.fn() } as any;
	});

	it("does not load Beacon experiments when experiments are disabled", async () => {
		render(
			<Analytics
				isEnabled={true}
				isExperimentsEnabled={false}
				beaconEndpoint="https://beacon.test"
				beaconSiteId="site-1"
			/>,
		);

		await waitFor(() => {
			expect(
				document.querySelector('script[src="https://beacon.test/beacon.min.js"]'),
			).toBeTruthy();
		});

		expect(
			document.querySelector('script[src="https://beacon.test/exp-beacon.min.js"]'),
		).toBeNull();
	});
});
