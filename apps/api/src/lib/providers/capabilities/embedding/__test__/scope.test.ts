import { describe, expect, it } from "vitest";

import {
	buildBedrockRetrievalFilter,
	buildS3VectorsMetadataFilter,
	buildVectorizeMetadataFilter,
} from "../utils/scope";

describe("embedding scope utilities", () => {
	it("builds Vectorize metadata filters from content type", () => {
		expect(
			buildVectorizeMetadataFilter({
				contentType: "note",
				filter: { source: "manual" },
			}),
		).toEqual({ source: "manual", type: "note" });
	});

	it("builds S3 Vectors metadata filters for namespace and content type", () => {
		expect(
			buildS3VectorsMetadataFilter({
				namespace: "user_kb_42",
				contentType: "note",
			}),
		).toEqual({
			$and: [{ namespace: { $eq: "user_kb_42" } }, { type: { $eq: "note" } }],
		});
	});

	it("uses content type, not Bedrock search type, for Bedrock metadata filtering", () => {
		expect(
			buildBedrockRetrievalFilter({
				namespace: "user_kb_42",
				type: "hybrid",
				contentType: "note",
			}),
		).toEqual({
			andAll: [
				{ equals: { key: "namespace", value: "user_kb_42" } },
				{ equals: { key: "type", value: "note" } },
			],
		});
	});

	it("adds user filters for shared custom namespaces", () => {
		expect(
			buildVectorizeMetadataFilter({
				namespace: "project-alpha",
				contentType: "note",
				userId: 42,
			}),
		).toEqual({ type: "note", userId: "42" });
	});
});
