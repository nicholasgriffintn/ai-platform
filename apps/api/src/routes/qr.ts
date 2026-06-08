import { Hono } from "hono";
import z from "zod/v4";

import { addRoute } from "~/lib/http/routeBuilder";
import { ResponseFactory } from "~/lib/http/ResponseFactory";
import {
	assertQrPayloadByteLength,
	createQrPng,
	createQrSvg,
	MAX_QR_PAYLOAD_BYTES,
	normaliseQrSize,
} from "~/utils/qr";

const app = new Hono();

addRoute(app, "get", "/", {
	tags: ["tools"],
	summary: "Create a QR code image",
	description:
		"Returns a first-party QR code image for bounded text, URLs, phone numbers, email addresses, or Wi-Fi payloads.",
	querySchema: z.object({
		data: z.string().min(1),
		format: z.enum(["png", "svg"]).optional(),
		size: z.string().optional(),
	}),
	responses: {
		200: { description: "PNG or SVG QR code image" },
		400: { description: "Invalid QR payload" },
	},
	handler: async ({ raw, query }) => {
		try {
			assertQrPayloadByteLength(query.data);
		} catch {
			return ResponseFactory.error(
				raw,
				`QR payloads are limited to ${MAX_QR_PAYLOAD_BYTES} UTF-8 bytes.`,
				400,
			);
		}

		const size = normaliseQrSize(query.size);
		const format = query.format ?? "png";
		const image =
			format === "svg"
				? createQrSvg(query.data, size.width, size.height)
				: (() => {
						const png = createQrPng(query.data, size.width, size.height);
						const buffer = new ArrayBuffer(png.byteLength);
						new Uint8Array(buffer).set(png);
						return new Blob([buffer], { type: "image/png" });
					})();

		return new Response(image, {
			headers: {
				"Cache-Control": "no-store",
				"Content-Type": format === "svg" ? "image/svg+xml; charset=utf-8" : "image/png",
				"X-Content-Type-Options": "nosniff",
			},
		});
	},
});

export default app;
