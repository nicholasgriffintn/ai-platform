import { describe, expect, it, vi } from "vitest";

import { PashiClient, PashiClientError } from "../client";
import type { PashiInfo, PashiTool } from "../contracts";

function createTool(overrides: Partial<PashiTool> = {}): PashiTool {
	return {
		aliases: [],
		audience: "Engineering",
		description: "Generate a value.",
		display: {
			actionLabel: "Generate",
			category: "Code",
			examples: [],
		},
		endpoint: "/api/uuid",
		id: "uuid",
		input: {
			fields: [
				{
					id: "count",
					label: "Count",
					placeholder: "1",
					required: true,
					type: "text",
				},
			],
			label: "Count",
			mode: "none",
			required: false,
		},
		label: "UUID",
		result: {
			kind: "text",
		},
		toolType: "generator",
		...overrides,
	};
}

function createInfo(tools: PashiTool[]): PashiInfo {
	return {
		name: "Pashi",
		tools,
	};
}

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		headers: {
			"Content-Type": "application/json",
		},
		status,
	});
}

describe("PashiClient", () => {
	it("caches and validates the live catalogue", async () => {
		const fetchMock = vi.fn(async () => jsonResponse(createInfo([createTool()])));
		const client = new PashiClient({
			apiKey: "test-pashi-key",
			fetch: fetchMock,
			now: () => 100,
		});

		await expect(client.getInfo()).resolves.toMatchObject({
			name: "Pashi",
			tools: [{ id: "uuid" }],
		});
		await client.getInfo();

		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(fetchMock).toHaveBeenCalledWith(
			"https://pashi.app/api/info",
			expect.objectContaining({
				headers: expect.objectContaining({
					Accept: "application/json",
					Authorization: "Bearer test-pashi-key",
				}),
			}),
		);
	});

	it("rejects a missing API key before making requests", () => {
		const fetchMock = vi.fn();

		expect(() => new PashiClient({ apiKey: " ", fetch: fetchMock })).toThrow(
			expect.objectContaining<Partial<PashiClientError>>({
				code: "configuration_error",
				message: "PASHI_API_KEY is required to access Pashi.",
			}),
		);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("rejects catalogue endpoints outside the pinned Pashi API path", async () => {
		const unsafeTool = {
			...createTool(),
			endpoint: "https://example.com/collect",
		};
		const client = new PashiClient({
			apiKey: "test-pashi-key",
			fetch: vi.fn(async () => jsonResponse(createInfo([unsafeTool as PashiTool]))),
		});

		await expect(client.getInfo()).rejects.toMatchObject({
			code: "invalid_catalog",
		});
	});

	it("executes text converters with schema-validated fields", async () => {
		const converter = createTool({
			api: {
				fields: [
					{
						id: "outputFormat",
						required: true,
						values: ["jira", "confluence"],
					},
				],
				methods: ["POST"],
				response: "json",
			},
			endpoint: "/api/markdown-to-jira",
			id: "markdown-to-jira",
			input: {
				kind: "text",
				label: "Markdown",
				required: true,
			},
			label: "Markdown to Jira",
			outputs: ["jira", "confluence"],
			result: undefined,
			runtime: "worker",
			status: "available",
			toolType: "converter",
		});
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(jsonResponse(createInfo([converter])))
			.mockResolvedValueOnce(jsonResponse({ kind: "text", result: "h2. Release" }));
		const client = new PashiClient({ apiKey: "test-pashi-key", fetch: fetchMock });

		await expect(
			client.execute({
				toolId: "markdown-to-jira",
				input: "## Release",
				fields: { outputFormat: "jira" },
			}),
		).resolves.toEqual({
			data: { kind: "text", result: "h2. Release" },
			resultKind: "fields",
			toolId: "markdown-to-jira",
			toolType: "converter",
		});
		expect(fetchMock).toHaveBeenNthCalledWith(
			2,
			"https://pashi.app/api/markdown-to-jira",
			expect.objectContaining({
				body: JSON.stringify({
					fields: { outputFormat: "jira" },
					input: "## Release",
				}),
				headers: expect.objectContaining({
					Authorization: "Bearer test-pashi-key",
				}),
				method: "POST",
			}),
		);
	});

	it("returns pinned image URLs without fetching generated content", async () => {
		const barcode = createTool({
			endpoint: "/api/barcode",
			id: "barcode",
			input: {
				fields: [
					{ id: "value", label: "Value", required: true, type: "text" },
					{ id: "height", label: "Height", required: true, type: "text" },
					{ id: "scale", label: "Scale", required: true, type: "text" },
				],
				label: "Value",
				mode: "text",
				required: true,
			},
			label: "Barcode",
			result: { kind: "image" },
		});
		const fetchMock = vi.fn(async () => jsonResponse(createInfo([barcode])));
		const client = new PashiClient({ apiKey: "test-pashi-key", fetch: fetchMock });

		const result = await client.execute({
			toolId: "barcode",
			fields: {
				height: "160",
				scale: "2",
				value: "ORDER-2048",
			},
		});

		expect(result).toEqual({
			data: {
				imageUrl: "https://pashi.app/api/barcode?generate=1&height=160&scale=2&value=ORDER-2048",
			},
			resultKind: "image",
			toolId: "barcode",
			toolType: "generator",
		});
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("rejects unknown fields and unsupported file converters before execution", async () => {
		const fileConverter = createTool({
			api: {
				fields: [{ id: "outputFormat", values: ["webp"] }],
			},
			endpoint: "/api/image-format",
			id: "image-format",
			input: {
				kind: "file",
				label: "Image file",
				required: true,
			},
			label: "Image formats",
			outputs: ["webp"],
			result: undefined,
			status: "available",
			toolType: "converter",
		});
		const client = new PashiClient({
			apiKey: "test-pashi-key",
			fetch: vi.fn(async () => jsonResponse(createInfo([createTool(), fileConverter]))),
		});

		await expect(
			client.execute({
				toolId: "uuid",
				fields: { count: "1", callbackUrl: "https://example.com" },
			}),
		).rejects.toMatchObject({
			code: "invalid_input",
			message: 'Field "callbackUrl" is not supported by Pashi tool "uuid".',
		});
		await expect(
			client.execute({
				toolId: "image-format",
				fields: { outputFormat: "webp" },
			}),
		).rejects.toEqual(
			expect.objectContaining<Partial<PashiClientError>>({
				code: "tool_unavailable",
			}),
		);
	});
});
