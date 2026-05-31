import type { TrainingModelDefinition } from "@assistant/schemas";
import { describe, expect, it, vi } from "vitest";

import { stageBedrockImportSource } from "./bedrockImportSource.js";

const MODEL: TrainingModelDefinition = {
	id: "lizzy-7b",
	provider: "aws-sagemaker",
	family: "huggingface",
	name: "Lizzy 7B",
	baseModel: "flwrlabs/Lizzy-7B",
	defaultHyperparameters: {},
};

describe("stageBedrockImportSource", () => {
	it("copies missing Hugging Face model files to the Bedrock import bucket", async () => {
		const fetchMock = vi.fn<typeof fetch>();
		const events: string[] = [];
		fetchMock
			.mockResolvedValueOnce(
				jsonResponse({
					siblings: [
						{ rfilename: "config.json", size: 100 },
						{ rfilename: "model.safetensors", size: 200 },
						{ rfilename: ".gitattributes", size: 10 },
					],
				}),
			)
			.mockResolvedValueOnce(new Response(null, { status: 404 }))
			.mockResolvedValueOnce(
				new Response("{}", { headers: { "content-type": "application/json" } }),
			)
			.mockResolvedValueOnce(new Response(null, { status: 200 }))
			.mockResolvedValueOnce(new Response(null, { status: 200 }));

		const s3Uri = await stageBedrockImportSource({
			env: {
				AWS_REGION: "us-east-1",
				AWS_ACCESS_KEY_ID: "access-key",
				AWS_SECRET_ACCESS_KEY: "secret-key",
				BEDROCK_IMPORT_BUCKET: "bedrock-imports",
			},
			model: MODEL,
			fetcher: fetchMock,
			onEvent: (event) => {
				events.push(event.message);
			},
		});

		expect(s3Uri).toBe("s3://bedrock-imports/models/flwrlabs-Lizzy-7B/");
		expect(events).toEqual([
			"Hugging Face model staging started",
			"Hugging Face model staging completed",
		]);
		expect(
			fetchMock.mock.calls.map(([input, init]) => [String(input), init?.method || "GET"]),
		).toEqual([
			["https://huggingface.co/api/models/flwrlabs/Lizzy-7B", "GET"],
			[
				"https://bedrock-imports.s3.us-east-1.amazonaws.com/models/flwrlabs-Lizzy-7B/config.json",
				"HEAD",
			],
			["https://huggingface.co/flwrlabs/Lizzy-7B/resolve/main/config.json", "GET"],
			[
				"https://bedrock-imports.s3.us-east-1.amazonaws.com/models/flwrlabs-Lizzy-7B/config.json",
				"PUT",
			],
			[
				"https://bedrock-imports.s3.us-east-1.amazonaws.com/models/flwrlabs-Lizzy-7B/model.safetensors",
				"HEAD",
			],
		]);
	});
});

function jsonResponse(body: unknown): Response {
	return new Response(JSON.stringify(body), {
		headers: { "content-type": "application/json" },
	});
}
