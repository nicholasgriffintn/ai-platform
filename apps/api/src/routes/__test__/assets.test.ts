import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import assets from "../assets";
import { securityHeaders } from "~/middleware/securityHeaders";

const readAssetMock = vi.hoisted(() => vi.fn());
const serviceContext = vi.hoisted(() => ({
	user: { id: 42 },
}));

vi.mock("~/lib/context/serviceContext", () => ({
	getServiceContext: vi.fn(() => serviceContext),
}));

vi.mock("~/lib/storage/read-asset", () => ({
	readAsset: readAssetMock,
}));

function createApp() {
	const app = new Hono();
	app.use(securityHeaders());
	app.route("/assets", assets);
	return app;
}

describe("assets route", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		readAssetMock.mockResolvedValue({
			asset: {
				id: "asset-123",
				key: "generations/image.png",
				mime_type: "image/png",
				filename: "image.png",
			},
			object: {
				arrayBuffer: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]).buffer),
			},
		});
	});

	it("allows authenticated private assets to render from the app origin", async () => {
		const response = await createApp().request(
			new Request("https://api.polychat.test/assets/asset-123", {
				headers: {
					origin: "http://localhost:5173",
				},
			}),
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("cross-origin-resource-policy")).toBe("cross-origin");
		expect(response.headers.get("content-type")).toBe("image/png");
		expect(readAssetMock).toHaveBeenCalledWith({
			context: serviceContext,
			assetId: "asset-123",
			userId: 42,
		});
	});
});
