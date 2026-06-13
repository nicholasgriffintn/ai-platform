import { describe, expect, it } from "vitest";

import qr from "../qr";

describe("qr route", () => {
	it("returns a first-party PNG QR image by default", async () => {
		const response = await qr.request("/?size=420x420&data=https%3A%2F%2Fpolychat.app");
		const body = new Uint8Array(await response.arrayBuffer());

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("image/png");
		expect(response.headers.get("cache-control")).toBe("no-store");
		expect(Array.from(body.subarray(0, 8))).toEqual([
			0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
		]);
	});

	it("loads a tool-generated QR image URL", async () => {
		const response = await qr.request(
			"/?size=300x300&format=png&data=https%3A%2F%2Fpolychat.app%2Finvite",
		);
		const body = new Uint8Array(await response.arrayBuffer());

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("image/png");
		expect(response.headers.get("x-content-type-options")).toBe("nosniff");
		expect(Array.from(body.subarray(0, 8))).toEqual([
			0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
		]);
	});

	it("returns SVG when requested", async () => {
		const response = await qr.request("/?format=svg&size=420x420&data=https%3A%2F%2Fpolychat.app");
		const body = await response.text();

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("image/svg+xml; charset=utf-8");
		expect(body).toContain('width="420"');
		expect(body).toContain('height="420"');
	});

	it("uses the default size when the requested size is invalid", async () => {
		const response = await qr.request("/?format=svg&size=5000x5000&data=polychat");
		const body = await response.text();

		expect(response.status).toBe(200);
		expect(body).toContain('width="300"');
		expect(body).toContain('height="300"');
	});

	it("rejects overlong payloads", async () => {
		const response = await qr.request(`/?data=${encodeURIComponent("x".repeat(272))}`);

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toMatchObject({
			message: "QR payloads are limited to 271 UTF-8 bytes.",
			status: "error",
		});
	});
});
