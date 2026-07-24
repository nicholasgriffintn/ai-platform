import { describe, expect, it, vi } from "vitest";

import { PashiClient } from "~/lib/pashi/client";
import type { PashiInfo } from "~/lib/pashi/contracts";
import { createPashiFunctionTools } from "../pashi";

const pashiInfo: PashiInfo = {
	name: "Pashi",
	tools: [
		{
			aliases: ["uuid-generator"],
			audience: "Engineering",
			description: "UUIDs across versions.",
			display: {
				actionLabel: "Generate UUID",
				category: "Code",
				examples: ["1"],
			},
			endpoint: "/api/uuid",
			id: "uuid",
			input: {
				fields: [
					{ id: "count", label: "Count", required: true, type: "text" },
					{
						id: "format",
						label: "Format",
						options: ["v4", "v7"],
						required: false,
						type: "select",
					},
				],
				label: "Count",
				mode: "none",
				required: false,
			},
			label: "UUID",
			result: { kind: "text" },
			toolType: "generator",
		},
		{
			aliases: ["md-to-jira"],
			api: {
				fields: [],
				methods: ["POST"],
				response: "json",
			},
			audience: "Documents",
			description: "Convert Markdown into Jira wiki markup.",
			display: {
				actionLabel: "Convert to Jira",
				category: "Jira and Confluence",
				examples: ["## Heading"],
			},
			endpoint: "/api/markdown-to-jira",
			id: "markdown-to-jira",
			input: {
				kind: "text",
				label: "Markdown",
				required: true,
			},
			label: "Markdown to Jira",
			outputs: ["jira"],
			runtime: "worker",
			status: "available",
			toolType: "converter",
		},
		{
			aliases: ["image-transcode"],
			api: {
				fields: [{ id: "outputFormat", values: ["webp"] }],
			},
			audience: "Media",
			description: "Convert image files.",
			display: {
				actionLabel: "Convert image",
				category: "Media",
				examples: [],
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
			runtime: "container",
			status: "available",
			toolType: "converter",
		},
	],
};

function jsonResponse(body: unknown): Response {
	return new Response(JSON.stringify(body), {
		headers: { "Content-Type": "application/json" },
	});
}

describe("Pashi function tools", () => {
	it("searches requested tool types and reports unsupported file converters", async () => {
		const client = new PashiClient({
			apiKey: "test-pashi-key",
			fetch: vi.fn(async () => jsonResponse(pashiInfo)),
		});
		const { search_pashi_tools } = createPashiFunctionTools(client);

		const result = await search_pashi_tools.execute(
			{
				tool_types: ["converter"],
				query: "image",
			},
			{} as never,
		);

		expect(result).toMatchObject({
			status: "success",
			data: {
				results: [
					{
						id: "image-format",
						executable: false,
						unavailableReason: "File converters are not supported by the chat integration yet.",
					},
				],
				toolTypes: ["converter"],
				totalTools: 3,
			},
		});
	});

	it("runs requested operations sequentially", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(jsonResponse(pashiInfo))
			.mockResolvedValueOnce(jsonResponse({ kind: "text", result: ["uuid-1"] }))
			.mockResolvedValueOnce(jsonResponse({ kind: "text", result: "h2. Heading" }));
		const client = new PashiClient({ apiKey: "test-pashi-key", fetch: fetchMock });
		const { run_pashi_tools } = createPashiFunctionTools(client);

		const result = await run_pashi_tools.execute(
			{
				operations: [
					{
						tool_id: "uuid",
						fields: { count: "1", format: "v4" },
					},
					{
						tool_id: "markdown-to-jira",
						input: "## Heading",
						fields: { outputFormat: "jira" },
					},
				],
			},
			{} as never,
		);

		expect(result).toMatchObject({
			status: "success",
			data: {
				completed: 2,
				failed: 0,
				results: [
					{ index: 0, status: "success", toolId: "uuid" },
					{ index: 1, status: "success", toolId: "markdown-to-jira" },
				],
				stoppedEarly: false,
			},
		});
		expect(fetchMock).toHaveBeenNthCalledWith(
			2,
			"https://pashi.app/api/uuid",
			expect.objectContaining({
				headers: expect.objectContaining({
					Authorization: "Bearer test-pashi-key",
				}),
				method: "POST",
			}),
		);
		expect(fetchMock).toHaveBeenNthCalledWith(
			3,
			"https://pashi.app/api/markdown-to-jira",
			expect.objectContaining({ method: "POST" }),
		);
	});

	it("stops after the first failure by default", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(jsonResponse(pashiInfo))
			.mockResolvedValueOnce(jsonResponse({ kind: "text", result: ["uuid-1"] }));
		const client = new PashiClient({ apiKey: "test-pashi-key", fetch: fetchMock });
		const { run_pashi_tools } = createPashiFunctionTools(client);

		const result = await run_pashi_tools.execute(
			{
				operations: [{ tool_id: "missing" }, { tool_id: "uuid", fields: { count: "1" } }],
			},
			{} as never,
		);

		expect(result).toMatchObject({
			status: "error",
			data: {
				completed: 0,
				failed: 1,
				stoppedEarly: true,
			},
		});
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("requires the Worker Pashi API key when using the production tools", async () => {
		const { search_pashi_tools } = createPashiFunctionTools();

		await expect(
			search_pashi_tools.execute(
				{
					tool_types: ["generator"],
				},
				{ env: {} } as never,
			),
		).rejects.toMatchObject({
			code: "configuration_error",
			message: "PASHI_API_KEY is required to access Pashi.",
		});
	});
});
